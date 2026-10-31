import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CheckoutAttempt, PlanCode as PrismaPlanCode, Prisma, SubscriptionStatus, WorkspaceRole, UserRole } from '@prisma/client';
import Stripe from 'stripe';
import { createClerkClient } from '@clerk/clerk-sdk-node';
import { PrismaService } from '../prisma/prisma.service';
import { BillingInterval, getPlanVariantByKey, getPlanVariantByStripePriceId, PlanCode, PlanDefinition, normalizePlanCode, buildPlanDefinitions } from '../billing/plan.config';
import { AnalyticsService } from '../common/analytics/analytics.service';
import { getStripeClient } from '../common/stripe/stripe-client';
import * as Sentry from '@sentry/nestjs';

@Injectable()
export class StripeEventsService {
  private readonly logger = new Logger(StripeEventsService.name);
  private readonly clerk: ReturnType<typeof createClerkClient>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly analytics: AnalyticsService,
    private readonly configService: ConfigService,
  ) {
    const secretKey = this.configService.get<string>('CLERK_SECRET_KEY');
    if (secretKey) {
      this.clerk = createClerkClient({ secretKey });
    }
  }

  async handleCheckoutSessionCompleted(event: Stripe.Event) {
    const session = event.data.object as Stripe.Checkout.Session;
    const sessionId = session.id;

    this.logger.log(`[checkout.session.completed] session=${sessionId}`);

    // Add Sentry breadcrumb for Stripe event processing
    Sentry.addBreadcrumb({
      category: 'stripe',
      message: 'Processing checkout.session.completed',
      level: 'info',
      data: { sessionId, eventId: event.id },
    });

    const attempt = await this.findCheckoutAttempt(session);
    let planKey = attempt?.planKey ?? (session.metadata?.planKey as string | undefined);
    let planVariant = planKey ? getPlanVariantByKey(planKey, this.configService) : null;

    // Fallback: If no planKey from metadata/attempt, extract from price ID
    // This handles Stripe Pricing Table checkouts that don't have our custom metadata
    if (!planVariant) {
      let priceId: string | undefined;
      const stripe = getStripeClient();
      
      // Try to get price ID from expanded line items first
      if (session.line_items?.data?.[0]?.price?.id) {
        priceId = session.line_items.data[0].price.id;
      } else {
        // Fetch session with expanded line items
        try {
          const expandedSession = await stripe.checkout.sessions.retrieve(session.id, {
            expand: ['line_items.data.price', 'subscription'],
          });
          
          if (expandedSession.line_items?.data?.[0]?.price?.id) {
            priceId = expandedSession.line_items.data[0].price.id;
          } else if (expandedSession.subscription) {
            // Fallback to subscription price
            const subscriptionId = typeof expandedSession.subscription === 'string'
              ? expandedSession.subscription
              : expandedSession.subscription.id;
            
            if (subscriptionId) {
              const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
                expand: ['items.data.price'],
              });
              priceId = subscription.items?.data?.[0]?.price?.id;
            }
          }
        } catch (err) {
          this.logger.warn(`[checkout.session.completed] Failed to retrieve expanded session: ${err.message}`);
        }
      }

      if (priceId) {
        // Find plan variant by price ID
        planVariant = getPlanVariantByStripePriceId(priceId, this.configService);
        if (planVariant) {
          planKey = planVariant.planKey;
          this.logger.log(`[checkout.session.completed] Resolved plan from price ID: ${planKey} (priceId=${priceId})`);
        }
      }
    }

    if (!planVariant) {
      this.logger.error(`[checkout.session.completed] No plan variant found for planKey=${planKey}, session=${sessionId}. Check session metadata and line items.`);
      return;
    }

    const user = await this.resolveUser(attempt, session);
    if (!user) {
      this.logger.error(`[checkout.session.completed] Could not resolve user for session=${sessionId}`);
      return;
    }

    const stripeCustomerId = typeof session.customer === 'string'
      ? session.customer
      : session.customer?.id;

    const stripeSubscriptionId = typeof session.subscription === 'string'
      ? session.subscription
      : (session.subscription as Stripe.Subscription | null)?.id;

    const targetWorkspaceId = await this.prisma.$transaction(async (tx) => {
      let workspaceId = await this.resolveWorkspaceId(tx, attempt, user.id);

      const subscriptionStatus = this.mapStripeStatus(
        (session.subscription as Stripe.Subscription | null)?.status,
      );

      const { start: periodStart, end: periodEnd } = this.calculateBillingPeriod(planVariant.billingInterval);

      if (!workspaceId) {
        const createdWorkspace = await this.createWorkspaceForUser(tx, user.name || user.email, planVariant.planCode);
        workspaceId = createdWorkspace.id;
        this.logger.log(`[checkout.session.completed] Created workspace=${workspaceId} for user=${user.id}`);
      }

      await this.ensureSubscription(tx, workspaceId, {
        planCode: planVariant.planCode,
        activeTaskLimit: planVariant.activeTaskLimit,
        slaSeconds: planVariant.tatSeconds,
        stripeSubscriptionId: stripeSubscriptionId ?? attempt?.stripeSubscriptionId ?? null,
        status: subscriptionStatus,
        billingPeriodStart: periodStart,
        billingPeriodEnd: periodEnd,
      });

      const member = await tx.workspaceMember.upsert({
        where: {
          workspaceId_userId: {
            workspaceId,
            userId: user.id,
          },
        },
        update: { role: WorkspaceRole.OWNER },
        create: {
          workspaceId,
          userId: user.id,
          role: WorkspaceRole.OWNER,
        },
      });

      this.logger.log(`[checkout.session.completed] Ensured workspaceMember=${member.id} workspace=${workspaceId} user=${user.id}`);

      if (attempt) {
        await tx.checkoutAttempt.update({
          where: { id: attempt.id },
          data: {
            status: 'COMPLETED',
            completedAt: attempt.completedAt ?? new Date(),
            workspaceId,
            stripeCustomerId,
            stripeSubscriptionId,
          },
        });
      }

      await this.provisionCredits(tx, workspaceId, planVariant, periodStart, periodEnd);

      return workspaceId;
    });

    this.logger.log(`[checkout.session.completed] Completed wiring for workspace=${targetWorkspaceId} session=${sessionId}`);

    // Track WorkspaceCreated analytics event
    if (targetWorkspaceId && user) {
      this.analytics.trackWorkspaceEvent(targetWorkspaceId, 'WorkspaceCreated', {
        userId: user.id,
        planCode: planVariant.planCode,
        billingInterval: planVariant.billingInterval,
        stripeSessionId: sessionId,
      });

      // Add Sentry breadcrumb for workspace creation
      Sentry.addBreadcrumb({
        category: 'stripe',
        message: 'Workspace created via Stripe checkout',
        level: 'info',
        data: {
          workspaceId: targetWorkspaceId,
          userId: user.id,
          planCode: planVariant.planCode,
          stripeSessionId: sessionId,
        },
      });
    }
  }

  async handleCustomerCreated(event: Stripe.Event) {
    this.logger.log(`[customer.created] event=${event.id}`);
  }

  async handleCustomerDeleted(event: Stripe.Event) {
    this.logger.log(`[customer.deleted] event=${event.id}`);
  }

  async handleCustomerUpdated(event: Stripe.Event) {
    this.logger.log(`[customer.updated] event=${event.id}`);
  }

  async handleSubscriptionCreated(event: Stripe.Event) {
    const subscription = event.data.object as Stripe.Subscription;
    this.logger.log(`[customer.subscription.created] id=${subscription.id} status=${subscription.status}`);
  }

  async handleSubscriptionDeleted(event: Stripe.Event) {
    const subscription = event.data.object as Stripe.Subscription;
    this.logger.log(`[customer.subscription.deleted] id=${subscription.id} status=${subscription.status}`);

    // Add Sentry breadcrumb for Stripe event
    Sentry.addBreadcrumb({
      category: 'stripe',
      message: 'Processing subscription.deleted',
      level: 'warning',
      data: { subscriptionId: subscription.id, status: subscription.status },
    });

    // Track SubscriptionCanceled analytics event
    const dbSubscription = await this.prisma.subscription.findFirst({
      where: { stripeSubscriptionId: subscription.id },
    });
    if (dbSubscription) {
      this.analytics.trackWorkspaceEvent(dbSubscription.workspaceId, 'SubscriptionCanceled', {
        planCode: dbSubscription.planCode,
        stripeSubscriptionId: subscription.id,
      });
    }
  }

  async handleSubscriptionPaused(event: Stripe.Event) {
    const stripeSub = event.data.object as Stripe.Subscription;
    this.logger.log(
      `[customer.subscription.paused] id=${stripeSub.id} status=${stripeSub.status} behavior=${stripeSub.pause_collection?.behavior}`,
    );

    const dbSubscription = await this.prisma.subscription.findFirst({
      where: { stripeSubscriptionId: stripeSub.id },
    });

    if (!dbSubscription) {
      this.logger.warn(`[customer.subscription.paused] No local subscription found for stripeSubscriptionId=${stripeSub.id}`);
      return;
    }

    const subscription = await this.prisma.subscription.update({
      where: { id: dbSubscription.id },
      data: {
        status: SubscriptionStatus.PAUSED,
        pausedAt: new Date(),
        pauseReason: dbSubscription.pauseReason ?? 'Paused via Stripe billing portal',
      },
    });

    this.logger.log(
      `[customer.subscription.paused] Marked workspace ${subscription.workspaceId} as PAUSED (via Stripe portal).`,
    );
  }

  async handleSubscriptionResumed(event: Stripe.Event) {
    const stripeSub = event.data.object as Stripe.Subscription;
    this.logger.log(
      `[customer.subscription.resumed] id=${stripeSub.id} status=${stripeSub.status}`,
    );

    const dbSubscription = await this.prisma.subscription.findFirst({
      where: { stripeSubscriptionId: stripeSub.id },
    });

    if (!dbSubscription) {
      this.logger.warn(`[customer.subscription.resumed] No local subscription found for stripeSubscriptionId=${stripeSub.id}`);
      return;
    }

    // Calculate how long it was paused based on local pausedAt
    let pauseDurationSeconds = 0;
    if (dbSubscription.pausedAt) {
      pauseDurationSeconds = Math.floor((Date.now() - dbSubscription.pausedAt.getTime()) / 1000);
    }

    const subscription = await this.prisma.subscription.update({
      where: { id: dbSubscription.id },
      data: {
        status: SubscriptionStatus.ACTIVE,
        pausedAt: null,
        pauseReason: null,
        totalPausedSeconds: {
          increment: pauseDurationSeconds,
        },
      },
    });

    this.logger.log(
      `[customer.subscription.resumed] Marked workspace ${subscription.workspaceId} as ACTIVE (via Stripe portal). ` +
      `Paused for ${pauseDurationSeconds} seconds.`,
    );
  }

  async handleSubscriptionUpdated(event: Stripe.Event) {
    const stripeSub = event.data.object as Stripe.Subscription;
    this.logger.log(`[customer.subscription.updated] id=${stripeSub.id} status=${stripeSub.status} cancel_at_period_end=${stripeSub.cancel_at_period_end ? 'true' : 'false'}`);

    // Track SubscriptionPlanChanged if plan changed
    const dbSubscription = await this.prisma.subscription.findFirst({
      where: { stripeSubscriptionId: stripeSub.id },
    });
    if (dbSubscription) {
      // 1) Sync plan changes (if price switched)
      const priceId = stripeSub.items?.data?.[0]?.price?.id;
      const newPlanVariant = priceId ? getPlanVariantByStripePriceId(priceId, this.configService) : null;

      if (newPlanVariant && newPlanVariant.planCode !== dbSubscription.planCode) {
        this.analytics.trackWorkspaceEvent(dbSubscription.workspaceId, 'SubscriptionPlanChanged', {
          previousPlanCode: dbSubscription.planCode,
          newPlanCode: newPlanVariant.planCode,
          stripeSubscriptionId: stripeSub.id,
        });
      }

      // 2) Sync status + cancel_at_period_end semantics
      // Stripe:
      // - status: 'active', 'canceled', 'past_due', etc.
      // - cancel_at_period_end: boolean flag when user clicks "Cancel" or "Don't cancel".
      //
      // Our rules:
      // - ACTIVE                       -> SubscriptionStatus.ACTIVE
      // - ACTIVE + cancel_at_period_end=true  -> SubscriptionStatus.CANCEL_AT_PERIOD_END
      // - CANCELED                    -> SubscriptionStatus.CANCELED
      // - PAST_DUE / PAUSED           -> corresponding enum values

      let nextStatus: SubscriptionStatus = this.mapStripeStatus(stripeSub.status);

      if (stripeSub.status === 'active') {
        if (stripeSub.cancel_at_period_end) {
          nextStatus = SubscriptionStatus.CANCEL_AT_PERIOD_END;
        } else {
          nextStatus = SubscriptionStatus.ACTIVE;
        }
      }

      const updateData: Prisma.SubscriptionUpdateInput = {
        status: nextStatus,
      };

      // Keep cancelAt aligned: if Stripe cleared cancel_at_period_end, clear local cancelAt.
      if (!stripeSub.cancel_at_period_end) {
        updateData.cancelAt = null;
      } else if (stripeSub.cancel_at || (stripeSub as any).current_period_end) {
        const ts = stripeSub.cancel_at || (stripeSub as any).current_period_end;
        updateData.cancelAt = new Date(ts * 1000);
      }

      await this.prisma.subscription.update({
        where: { id: dbSubscription.id },
        data: updateData,
      });

      this.logger.log(
        `[customer.subscription.updated] Synced status for workspace=${dbSubscription.workspaceId}: ` +
        `Stripe status=${stripeSub.status}, cancel_at_period_end=${stripeSub.cancel_at_period_end ? 'true' : 'false'} -> ` +
        `local status=${nextStatus}`,
      );
    }
  }

  async handleInvoicePaid(event: Stripe.Event) {
    this.logger.log(`[invoice.paid] event=${event.id}`);
    const invoice = event.data.object as Stripe.Invoice;

    const invoiceSubscription = (invoice as any).subscription as string | Stripe.Subscription | null | undefined;
    const stripeSubscriptionId = typeof invoiceSubscription === 'string'
      ? invoiceSubscription
      : (invoiceSubscription as Stripe.Subscription | null)?.id;

    if (!stripeSubscriptionId) {
      this.logger.warn('[invoice.paid] Missing subscription id on invoice');
      return;
    }

    const subscription = await this.prisma.subscription.findFirst({
      where: { stripeSubscriptionId },
    });

    if (!subscription) {
      this.logger.warn(`[invoice.paid] No subscription found for stripeSubscriptionId=${stripeSubscriptionId}`);
      return;
    }

    const workspaceId = subscription.workspaceId;
    const price = (invoice.lines?.data?.[0] as any)?.price as Stripe.Price | undefined;
    const priceId = price?.id;
    const planVariant = priceId ? getPlanVariantByStripePriceId(priceId, this.configService) : null;
    const fallbackPlanCode = normalizePlanCode(subscription.planCode);
    const effectiveVariant = planVariant 
      ?? (fallbackPlanCode ? getPlanVariantByKey(`${fallbackPlanCode}_MONTHLY`, this.configService) : null)
      ?? (fallbackPlanCode ? getPlanVariantByKey(`${fallbackPlanCode}_YEARLY`, this.configService) : null);

    if (!effectiveVariant) {
      this.logger.warn(`[invoice.paid] Unable to resolve plan variant for subscription ${subscription.id}`);
      return;
    }

    const linePeriod = invoice.lines?.data?.[0]?.period;
    const periodStart = linePeriod?.start ? new Date(linePeriod.start * 1000) : this.calculateBillingPeriod(effectiveVariant.billingInterval).start;
    const periodEnd = linePeriod?.end ? new Date(linePeriod.end * 1000) : this.calculateBillingPeriod(effectiveVariant.billingInterval, periodStart).end;

    await this.prisma.$transaction(async (tx) => {
      // CORE plan now supports both Design + Motion (no mode restriction)
      const mode = null;

      await tx.subscription.update({
        where: { id: subscription.id },
        data: {
          billingPeriodStart: periodStart,
          billingPeriodEnd: periodEnd,
          status: SubscriptionStatus.ACTIVE,
          planCode: effectiveVariant.planCode as unknown as PrismaPlanCode,
          activeTaskLimit: effectiveVariant.activeTaskLimit,
          slaSeconds: effectiveVariant.tatSeconds,
          mode,
        },
      });

      await this.provisionCredits(tx, workspaceId, effectiveVariant, periodStart, periodEnd);
    });
  }

  async handleInvoicePaymentSucceeded(event: Stripe.Event) {
    const invoice = event.data.object as Stripe.Invoice;
    this.logger.log(`[invoice.payment_succeeded] event=${event.id} invoice=${invoice.id}`);

    const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
    if (!customerId) return;

    // Get subscription ID from invoice (handle both string and object types)
    const invoiceSubscription = (invoice as any).subscription;
    const stripeSubscriptionId = typeof invoiceSubscription === 'string'
      ? invoiceSubscription
      : invoiceSubscription?.id ?? undefined;

    if (!stripeSubscriptionId) return;

    // Find workspace by Stripe subscription ID
    const subscription = await this.prisma.subscription.findFirst({
      where: { stripeSubscriptionId },
    });

    if (subscription) {
      const amount = invoice.amount_paid || 0;
      const currency = invoice.currency || 'usd';

      this.analytics.trackPaymentSucceeded(
        subscription.workspaceId,
        amount / 100, // Convert cents to dollars
        currency.toUpperCase(),
      );

      this.logger.log(`[invoice.payment_succeeded] Tracked payment for workspace ${subscription.workspaceId}: ${amount / 100} ${currency}`);
    }
  }

  async handleInvoicePaymentFailed(event: Stripe.Event) {
    const invoice = event.data.object as Stripe.Invoice;
    this.logger.log(`[invoice.payment_failed] event=${event.id} invoice=${invoice.id}`);

    const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
    if (!customerId) return;

    // Get subscription ID from invoice (handle both string and object types)
    const invoiceSubscription = (invoice as any).subscription;
    const stripeSubscriptionId = typeof invoiceSubscription === 'string'
      ? invoiceSubscription
      : invoiceSubscription?.id ?? undefined;

    if (!stripeSubscriptionId) return;

    // Find workspace by Stripe subscription ID
    const subscription = await this.prisma.subscription.findFirst({
      where: { stripeSubscriptionId },
      include: {
        workspace: {
          include: {
            members: {
              where: { role: 'OWNER' },
              include: { user: true },
            },
          },
        },
      },
    });

    if (subscription) {
      const amount = invoice.amount_due || 0;
      const currency = invoice.currency || 'usd';
      const errorCode = invoice.last_finalization_error?.code;

      // Track analytics
      this.analytics.trackPaymentFailed(
        subscription.workspaceId,
        amount / 100,
        currency.toUpperCase(),
        errorCode,
      );

      this.logger.log(`[invoice.payment_failed] Tracked failed payment for workspace ${subscription.workspaceId}: ${amount / 100} ${currency}`);

      // Log to Sentry
      Sentry.captureMessage(`Payment failed for workspace ${subscription.workspaceId}`, {
        level: 'warning',
        tags: {
          workspaceId: subscription.workspaceId,
          errorCode: errorCode || 'unknown',
        },
        extra: {
          invoiceId: invoice.id,
          amount,
          currency,
        },
      });
    }
  }

  async handleInvoiceUpcoming(event: Stripe.Event) {
    this.logger.log(`[invoice.upcoming] event=${event.id}`);
  }

  async handleBillingPortalConfigurationUpdated(event: Stripe.Event) {
    this.logger.log(`[billing_portal.configuration.updated] event=${event.id}`);
  }

  async handleBillingPortalSessionCreated(event: Stripe.Event) {
    this.logger.log(`[billing_portal.session.created] event=${event.id}`);
  }

  async handlePriceUpdated(event: Stripe.Event) {
    this.logger.log(`[price.updated] event=${event.id}`);
  }

  async handleProductUpdated(event: Stripe.Event) {
    this.logger.log(`[product.updated] event=${event.id}`);
  }

  private async findCheckoutAttempt(session: Stripe.Checkout.Session) {
    if (session.id) {
      const attempt = await this.prisma.checkoutAttempt.findUnique({
        where: { stripeSessionId: session.id },
      });
      if (attempt) return attempt;
    }

    const attemptId = session.metadata?.checkoutAttemptId as string | undefined;
    if (attemptId) {
      return this.prisma.checkoutAttempt.findUnique({ where: { id: attemptId } });
    }

    return null;
  }

  private async resolveUser(
    attempt: CheckoutAttempt | null,
    session: Stripe.Checkout.Session,
  ) {
    if (attempt?.userId) {
      const existing = await this.prisma.user.findUnique({ where: { id: attempt.userId } });
      if (existing) {
        return existing;
      }
    }

    // Check client_reference_id (used by Stripe Pricing Table)
    // This is typically the Clerk user ID passed from the frontend
    if (session.client_reference_id) {
      // Try as Clerk user ID first
      const byClerkId = await this.prisma.user.findFirst({
        where: { clerkUserId: session.client_reference_id },
      });
      if (byClerkId) return byClerkId;
      
      // Try as direct user ID
      const byUserId = await this.prisma.user.findUnique({
        where: { id: session.client_reference_id },
      });
      if (byUserId) return byUserId;

      // User doesn't exist in our DB yet - create them from Clerk
      // This happens when a new user signs up and goes directly to pricing page
      // before hitting any authenticated API endpoint
      if (this.clerk) {
        try {
          const clerkUser = await this.clerk.users.getUser(session.client_reference_id);
          const email = clerkUser.emailAddresses?.[0]?.emailAddress;
          const name = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ') || undefined;
          
          if (email) {
            // Check if user exists by email (might be a pre-existing user)
            const existingByEmail = await this.prisma.user.findUnique({ where: { email } });
            if (existingByEmail) {
              // Link the existing user to Clerk
              const linkedUser = await this.prisma.user.update({
                where: { id: existingByEmail.id },
                data: { clerkUserId: session.client_reference_id },
              });
              this.logger.log(`[resolveUser] Linked existing user ${email} to Clerk ID ${session.client_reference_id}`);
              return linkedUser;
            }

            // Create new user from Clerk data
            const newUser = await this.prisma.user.create({
              data: {
                email,
                name,
                clerkUserId: session.client_reference_id,
                role: UserRole.CLIENT,
              },
            });
            this.logger.log(`[resolveUser] Created new user from Clerk: ${email} (clerkId=${session.client_reference_id})`);
            return newUser;
          }
        } catch (err) {
          this.logger.warn(`[resolveUser] Failed to fetch/create user from Clerk: ${err.message}`);
        }
      }
    }

    const metadataUserId = session.metadata?.userId as string | undefined;
    if (metadataUserId) {
      const fromMetadata = await this.prisma.user.findUnique({ where: { id: metadataUserId } });
      if (fromMetadata) return fromMetadata;
    }

    const email = session.customer_details?.email || attempt?.email;
    if (email) {
      const existingUser = await this.prisma.user.findUnique({ where: { email } });
      if (existingUser) return existingUser;

      // Create user from checkout email as last resort
      // This happens for Stripe Pricing Table sessions where we have email but no Clerk ID
      if (session.customer_details?.email) {
        try {
          const newUser = await this.prisma.user.create({
            data: {
              email: session.customer_details.email,
              name: session.customer_details.name || undefined,
              role: UserRole.CLIENT,
            },
          });
          this.logger.log(`[resolveUser] Created new user from checkout email: ${email}`);
          return newUser;
        } catch (err) {
          this.logger.warn(`[resolveUser] Failed to create user from checkout email: ${err.message}`);
        }
      }
    }

    return null;
  }

  private async resolveWorkspaceId(
    tx: Prisma.TransactionClient,
    attempt: CheckoutAttempt | null,
    userId: string,
  ): Promise<string | null> {
    if (attempt?.workspaceId) {
      const workspace = await tx.workspace.findUnique({ where: { id: attempt.workspaceId } });
      if (workspace) return workspace.id;
    }

    const existingMembership = await tx.workspaceMember.findFirst({
      where: { userId },
      orderBy: [{ createdAt: 'desc' }],
    });

    return existingMembership?.workspaceId ?? null;
  }

  private async createWorkspaceForUser(
    tx: Prisma.TransactionClient,
    displayName: string,
    planCode: PlanCode,
  ) {
    const baseName = (displayName || 'workspace').trim();
    const baseSlug = baseName.toLowerCase().replace(/[^a-z0-9]/g, '-') || 'workspace';

    let slug = baseSlug;
    let counter = 1;

    // Ensure uniqueness
    while (await tx.workspace.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${counter}`;
      counter += 1;
    }

    return tx.workspace.create({
      data: {
        name: `${baseName}'s Workspace`,
        slug,
        timezone: 'UTC',
        plan: {
          connect: { code: planCode as unknown as PrismaPlanCode },
        },
      },
    });
  }

  private async ensureSubscription(
    tx: Prisma.TransactionClient,
    workspaceId: string,
    options: {
      planCode: PlanCode;
      activeTaskLimit: number;
      slaSeconds: number;
      stripeSubscriptionId?: string | null;
      status: SubscriptionStatus;
      billingPeriodStart?: Date;
      billingPeriodEnd?: Date;
    },
  ) {
    const existing = await tx.subscription.findUnique({
      where: { workspaceId },
    });

    const prismaPlanCode = options.planCode as unknown as PrismaPlanCode;

    // CORE plan now supports both Design + Motion (no mode restriction)
    const mode = null;

    if (existing) {
      await tx.subscription.update({
        where: { workspaceId },
        data: {
          planCode: prismaPlanCode,
          activeTaskLimit: options.activeTaskLimit,
          slaSeconds: options.slaSeconds,
          mode,
          status: options.status,
          stripeSubscriptionId: options.stripeSubscriptionId ?? existing.stripeSubscriptionId,
          billingPeriodStart: options.billingPeriodStart ?? existing.billingPeriodStart,
          billingPeriodEnd: options.billingPeriodEnd ?? existing.billingPeriodEnd,
        },
      });

      // Also update the workspace's plan relationship
      const newPlan = await tx.plan.findUnique({ where: { code: prismaPlanCode } });
      if (newPlan) {
        await tx.workspace.update({
          where: { id: workspaceId },
          data: { planId: newPlan.id },
        });
      }

      return existing;
    }

    return tx.subscription.create({
      data: {
        workspaceId,
        planCode: prismaPlanCode,
        activeTaskLimit: options.activeTaskLimit,
        slaSeconds: options.slaSeconds,
        mode,
        status: options.status,
        stripeSubscriptionId: options.stripeSubscriptionId,
        billingPeriodStart: options.billingPeriodStart,
        billingPeriodEnd: options.billingPeriodEnd,
      },
    });
  }

  private calculateBillingPeriod(interval: BillingInterval, startOverride?: Date) {
    const start = startOverride ? new Date(startOverride) : new Date();
    const end = new Date(start);

    if (interval === BillingInterval.YEARLY) {
      end.setFullYear(end.getFullYear() + 1);
    } else {
      end.setMonth(end.getMonth() + 1);
    }

    return { start, end };
  }

  private async provisionCredits(
    tx: Prisma.TransactionClient,
    workspaceId: string,
    plan: PlanDefinition,
    periodStart: Date,
    periodEnd: Date,
  ) {
    const dayCreditsTotal = plan.dayCreditsPerCycle;
    const aiCreditsTotal = plan.aiCreditsPerCycle;

    // Get subscription to check pause duration for rollover limits
    const subscription = await tx.subscription.findUnique({
      where: { workspaceId },
    });

    // Calculate rollover credits from previous period (if within pause limits)
    let rolloverCredits = 0;
    if (subscription) {
      // Find previous period's day credit
      const previousDayCredit = await tx.dayCredit.findFirst({
        where: {
          workspaceId,
          periodEnd: { lt: periodStart },
        },
        orderBy: { periodEnd: 'desc' },
      });

      if (previousDayCredit) {
        const unusedCredits = previousDayCredit.totalCredits - previousDayCredit.usedCredits;
        
        if (unusedCredits > 0) {
          // Check if rollover is allowed based on pause duration
          // Calculate pause duration in months (using average month length: 30.44 days)
          const pauseDurationDays = subscription.totalPausedSeconds / (24 * 60 * 60);
          const pauseDurationMonths = pauseDurationDays / 30.44;
          
          // Rollover limits: 3 months for monthly plans, 6 months for annual plans
          const maxRolloverMonths = plan.billingInterval === BillingInterval.MONTHLY ? 3 : 6;
          
          if (pauseDurationMonths <= maxRolloverMonths) {
            rolloverCredits = unusedCredits;
            this.logger.log(
              `Rolling over ${rolloverCredits} day credits for workspace ${workspaceId} ` +
              `(pause duration: ${pauseDurationMonths.toFixed(2)} months, limit: ${maxRolloverMonths} months)`
            );
          } else {
            this.logger.log(
              `Rollover blocked for workspace ${workspaceId}: ` +
              `pause duration ${pauseDurationMonths.toFixed(2)} months exceeds limit of ${maxRolloverMonths} months ` +
              `(${unusedCredits} unused credits will not rollover)`
            );
          }
        }
      }
    }

    const finalDayCreditsTotal = dayCreditsTotal + rolloverCredits;

    const existingDayCredit = await tx.dayCredit.findFirst({
      where: { workspaceId, periodStart, periodEnd },
    });

    if (existingDayCredit) {
      await tx.dayCredit.update({
        where: { id: existingDayCredit.id },
        data: {
          totalCredits: finalDayCreditsTotal,
          usedCredits: 0,
          periodStart,
          periodEnd,
        },
      });

      // Log credit reset in history
      await tx.dayCreditHistory.create({
        data: {
          workspaceId,
          action: 'RESET',
          amount: finalDayCreditsTotal,
          balanceBefore: existingDayCredit.usedCredits,
          balanceAfter: 0,
          periodStart,
          periodEnd,
          notes: rolloverCredits > 0 ? `Includes ${rolloverCredits} rollover credits` : null,
        },
      });
    } else {
      await tx.dayCredit.create({
        data: {
          workspaceId,
          totalCredits: finalDayCreditsTotal,
          usedCredits: 0,
          periodStart,
          periodEnd,
        },
      });

      // Log credit provision in history
      await tx.dayCreditHistory.create({
        data: {
          workspaceId,
          action: 'RESET',
          amount: finalDayCreditsTotal,
          balanceBefore: 0,
          balanceAfter: 0,
          periodStart,
          periodEnd,
          notes: rolloverCredits > 0 ? `New period with ${rolloverCredits} rollover credits` : 'New billing period',
        },
      });
    }

    const existingAiCredit = await tx.aICredit.findFirst({
      where: { workspaceId, periodStart, periodEnd },
    });

    if (existingAiCredit) {
      await tx.aICredit.update({
        where: { id: existingAiCredit.id },
        data: {
          totalCredits: aiCreditsTotal,
          usedCredits: 0,
          periodStart,
          periodEnd,
        },
      });
    } else {
      await tx.aICredit.create({
        data: {
          workspaceId,
          totalCredits: aiCreditsTotal,
          usedCredits: 0,
          periodStart,
          periodEnd,
        },
      });
    }
  }

  private mapStripeStatus(status?: string | null): SubscriptionStatus {
    switch (status) {
      case 'trialing':
      case 'active':
        return SubscriptionStatus.ACTIVE;
      case 'paused':
        return SubscriptionStatus.PAUSED;
      case 'past_due':
        return SubscriptionStatus.PAST_DUE;
      case 'canceled':
      case 'unpaid':
        return SubscriptionStatus.CANCELED;
      default:
        return SubscriptionStatus.ACTIVE;
    }
  }
}
