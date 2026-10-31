/**
 * Stripe Controller
 * Handles Stripe webhook events and billing-related endpoints
 */

import {
  Controller,
  Post,
  Headers,
  RawBodyRequest,
  Req,
  HttpCode,
  HttpStatus,
  Logger,
  BadRequestException,
  Get,
  Body,
  Param,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags, ApiOperation, ApiResponse, ApiSecurity, ApiExcludeEndpoint } from '@nestjs/swagger';
import { Request } from 'express';
import Stripe from 'stripe';
import { getStripeClient, getWebhookSecret, getPublishableKey } from '../common/stripe/stripe-client';
import { isStripeConfigured } from '../common/stripe/stripe.config';
import { StripeEventsService } from './stripe-events.service';
import { CreateCheckoutSessionDto, CreateComposerCheckoutDto } from './dto/create-checkout-session.dto';
import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionStatus } from '@prisma/client';
import { DayCreditBurnService } from '../credits/day-credit-burn.service';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { BillingInterval, getPlanByCode, getPlanVariantByKey, normalizePlanCode, getPriceIdForPlan } from '../billing/plan.config';

import { BypassSubscription } from '../billing/decorators/bypass-subscription.decorator';
import { SuperAdmin } from '../common/decorators/super-admin.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthUser } from '../auth/clerk.config';
import { BypassWorkspaceMember } from '../common/decorators/bypass-workspace-member.decorator';
import { MarketingOfferService } from '../marketing/marketing-offer.service';

@ApiTags('Stripe')
@Controller('stripe')
@BypassSubscription()
export class StripeController {
  private readonly logger = new Logger(StripeController.name);
  private stripeInstance: Stripe | null = null;

  constructor(
    private readonly stripeEventsService: StripeEventsService,
    private readonly prisma: PrismaService,
    private readonly dayCreditBurnService: DayCreditBurnService,
    private readonly configService: ConfigService,
    private readonly marketingOfferService: MarketingOfferService,
  ) { }

  /**
   * Lazy-load Stripe client to avoid startup errors if keys aren't configured
   */
  private getStripe(): Stripe {
    if (!this.stripeInstance) {
      this.stripeInstance = getStripeClient();
    }
    return this.stripeInstance;
  }

  /**
   * Stripe Webhook Endpoint
   * Receives and processes Stripe events
   * 
   * **Internal endpoint - called by Stripe, not by clients**
   * 
   * This endpoint is excluded from Swagger documentation as it's an internal webhook
   * endpoint called by Stripe's servers. It handles all subscription lifecycle events:
   * - checkout.session.completed
   * - customer.subscription.created/updated/deleted/paused/resumed
   * - invoice.paid/payment_succeeded/payment_failed/upcoming
   * - customer.created/updated/deleted
   * - price.updated, product.updated
   * 
   * **Webhook URL for Stripe Dashboard:**
   * - Local: `http://localhost:3001/api/v1/stripe/webhook` (use Stripe CLI)
   * - Production: `https://your-domain.com/api/v1/stripe/webhook`
   * 
   * **Testing locally:**
   * ```bash
   * stripe listen --forward-to localhost:3001/api/v1/stripe/webhook
   * ```
   */
  @Public()
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiExcludeEndpoint() // Exclude from Swagger docs - internal webhook endpoint
  async handleWebhook(
    @Headers('stripe-signature') signature: string,
    @Req() request: RawBodyRequest<Request>,
  ): Promise<{ received: boolean }> {
    if (!isStripeConfigured()) {
      this.logger.error('Webhook received but Stripe is not configured');
      throw new BadRequestException('Stripe is not configured');
    }

    if (!signature) {
      throw new BadRequestException('Missing stripe-signature header');
    }

    // Get raw body for signature verification
    const rawBody = request.rawBody;
    if (!rawBody) {
      throw new BadRequestException('Missing raw body for signature verification');
    }

    let event: Stripe.Event;

    try {
      // Verify webhook signature
      const stripe = this.getStripe();
      event = stripe.webhooks.constructEvent(
        rawBody,
        signature,
        getWebhookSecret(),
      );
    } catch (err) {
      this.logger.error(`Webhook signature verification failed: ${err.message}`);
      throw new BadRequestException('Webhook signature verification failed');
    }

    this.logger.log(`Received webhook event: ${event.type}, id: ${event.id}`);

    // Route event to appropriate handler
    try {
      await this.routeEvent(event);
    } catch (error) {
      this.logger.error(`Error handling webhook event ${event.type}: ${error.message}`, error.stack);
      // Still return 200 to acknowledge receipt to Stripe
      // Consider implementing a retry queue for failed events
    }

    return { received: true };
  }

  /**
   * Route Stripe event to appropriate handler
   */
  private async routeEvent(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case 'billing_portal.configuration.updated':
        await this.stripeEventsService.handleBillingPortalConfigurationUpdated(event);
        break;

      case 'billing_portal.session.created':
        await this.stripeEventsService.handleBillingPortalSessionCreated(event);
        break;

      case 'checkout.session.completed':
        await this.stripeEventsService.handleCheckoutSessionCompleted(event);
        break;

      case 'customer.created':
        await this.stripeEventsService.handleCustomerCreated(event);
        break;

      case 'customer.deleted':
        await this.stripeEventsService.handleCustomerDeleted(event);
        break;

      case 'customer.updated':
        await this.stripeEventsService.handleCustomerUpdated(event);
        break;

      case 'customer.subscription.created':
        await this.stripeEventsService.handleSubscriptionCreated(event);
        break;

      case 'customer.subscription.deleted':
        await this.stripeEventsService.handleSubscriptionDeleted(event);
        break;

      case 'customer.subscription.paused':
        await this.stripeEventsService.handleSubscriptionPaused(event);
        break;

      case 'customer.subscription.resumed':
        await this.stripeEventsService.handleSubscriptionResumed(event);
        break;

      case 'customer.subscription.updated':
        await this.stripeEventsService.handleSubscriptionUpdated(event);
        break;

      case 'invoice.paid':
        await this.stripeEventsService.handleInvoicePaid(event);
        break;

      case 'invoice.payment_succeeded':
        await this.stripeEventsService.handleInvoicePaymentSucceeded(event);
        break;

      case 'invoice.payment_failed':
        await this.stripeEventsService.handleInvoicePaymentFailed(event);
        break;

      case 'invoice.upcoming':
        await this.stripeEventsService.handleInvoiceUpcoming(event);
        break;

      case 'price.updated':
        await this.stripeEventsService.handlePriceUpdated(event);
        break;

      case 'product.updated':
        await this.stripeEventsService.handleProductUpdated(event);
        break;

      default:
        this.logger.warn(`Unhandled webhook event type: ${event.type}`);
    }
  }

  /**
   * Get Stripe publishable key for frontend
   * Used to initialize Stripe.js in the frontend application
   */
  @Get('config')
  @ApiOperation({
    summary: 'Get Stripe publishable key for frontend',
    description: 'Returns the Stripe publishable key (pk_test_... or pk_live_...) for initializing Stripe.js in the frontend. This endpoint is public and safe to expose to clients.',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns Stripe publishable key',
    schema: {
      properties: {
        publishableKey: { type: 'string', example: 'pk_test_...' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Stripe is not configured' })
  getConfig(): { publishableKey: string } {
    if (!isStripeConfigured()) {
      throw new BadRequestException('Stripe is not configured. Please set STRIPE_PUBLISHABLE_KEY, STRIPE_SECRET_KEY, and STRIPE_WEBHOOK_SECRET environment variables.');
    }
    return {
      publishableKey: getPublishableKey(),
    };
  }

  /**
   * Recover billing session
   * Used when webhook hasn't created workspace yet - fetches real Stripe data and creates workspace
   * IMPORTANT: This endpoint is authenticated and validates checkout session ownership
   */
  @Post('recover-session')
  @BypassWorkspaceMember() // No workspace yet – allow without x-workspace-id header
  @BypassSubscription() // User doesn't have workspace yet, can't check subscription
  @ApiOperation({
    summary: 'Recover billing session',
    description: 'Creates workspace from Stripe checkout session when webhook is delayed. Safe to call multiple times. Requires authentication.',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns recovery status',
    schema: {
      properties: {
        status: { type: 'string', enum: ['processing', 'completed', 'not_found', 'unauthorized'] },
        workspaceId: { type: 'string', nullable: true },
        message: { type: 'string' },
      },
    },
  })
  async recoverSession(
    @Body() body: { sessionId: string },
    @CurrentUser() user: AuthUser,
  ): Promise<{ status: string; workspaceId?: string; message: string }> {
    if (!isStripeConfigured()) {
      throw new BadRequestException('Stripe is not configured');
    }

    const { sessionId } = body;
    if (!sessionId) {
      throw new BadRequestException('sessionId is required');
    }

    this.logger.log(`[RecoverSession] User ${user.email} (${user.id}) attempting recovery for session: ${sessionId}`);

    const stripe = this.getStripe();

    // Fetch checkout session from Stripe
    let session: Stripe.Checkout.Session;
    try {
      session = await stripe.checkout.sessions.retrieve(sessionId, {
        expand: ['subscription', 'customer'],
      });
    } catch (err) {
      this.logger.error(`[RecoverSession] Failed to fetch session: ${err.message}`);
      return {
        status: 'not_found',
        message: 'Checkout session not found in Stripe. Please contact support.',
      };
    }

    // SECURITY: Verify ownership - session must belong to current user
    // First, try to resolve via CheckoutAttempt (for flows using our own checkout API)
    const attempt = await this.prisma.checkoutAttempt.findUnique({
      where: { stripeSessionId: sessionId },
    }).catch(() => null);

    // Also derive ownership from Stripe session itself (for Stripe Pricing Table / external flows)
    const clientRefId = session.client_reference_id || undefined;

    // Best-effort email resolution for ownership checks
    let sessionEmail: string | undefined = session.customer_details?.email || undefined;

    // Fallback: if customer object is expanded and not deleted, use its email
    if (!sessionEmail && session.customer && typeof session.customer === 'object' && !('deleted' in session.customer)) {
      sessionEmail = (session.customer as Stripe.Customer).email || undefined;
    }

    const matchesCurrentUser =
      !!user &&
      (
        clientRefId === user.id ||
        clientRefId === user.clerkUserId ||
        (!!sessionEmail && !!user.email && sessionEmail.toLowerCase() === user.email.toLowerCase())
      );

    if (attempt) {
      // Validate that the checkout attempt belongs to the current user
      if (attempt.userId !== user.id) {
        this.logger.warn(
          `[RecoverSession] Ownership violation: user ${user.id} tried to recover session ${sessionId} owned by ${attempt.userId}`,
        );
        return {
          status: 'unauthorized',
          message: 'This checkout session does not belong to your account.',
        };
      }
    } else {
      // No CheckoutAttempt row – this is expected for Stripe Pricing Table-based checkouts.
      // Fall back to strict ownership checks using client_reference_id and email.
      if (!matchesCurrentUser) {
        this.logger.warn(
          `[RecoverSession] No CheckoutAttempt for session ${sessionId} and Stripe session does not match current user ${user.id}`,
        );
        return {
          status: 'unauthorized',
          message: 'This checkout session does not belong to your account.',
        };
      }

      this.logger.log(
        `[RecoverSession] Proceeding without CheckoutAttempt for session ${sessionId} (likely Stripe Pricing Table flow)`,
      );
    }

    // Check if payment is complete
    if (session.payment_status !== 'paid') {
      return {
        status: 'processing',
        message: 'Payment is still processing. Please wait and try again.',
      };
    }

    // Get subscription
    const subscriptionId = typeof session.subscription === 'string'
      ? session.subscription
      : session.subscription?.id;

    if (!subscriptionId) {
      return {
        status: 'processing',
        message: 'Subscription is being created. Please wait and try again.',
      };
    }

    // Check if workspace already exists for this subscription (idempotency)
    const existing = await this.prisma.subscription.findFirst({
      where: { stripeSubscriptionId: subscriptionId },
      include: { workspace: true },
    });

    if (existing?.workspace) {
      this.logger.log(`[RecoverSession] Workspace already exists: ${existing.workspaceId}`);

      // Verify user has access to this workspace
      const membership = await this.prisma.workspaceMember.findUnique({
        where: {
          workspaceId_userId: {
            workspaceId: existing.workspaceId,
            userId: user.id,
          },
        },
      });

      if (!membership) {
        this.logger.error(`[RecoverSession] Workspace exists but user ${user.id} is not a member`);
        return {
          status: 'unauthorized',
          message: 'Workspace exists but you do not have access.',
        };
      }

      return {
        status: 'completed',
        workspaceId: existing.workspaceId,
        message: 'Workspace found. Redirecting...',
      };
    }

    // Now trigger workspace creation using real subscription data
      this.logger.log(
        `[RecoverSession] Creating workspace for user ${attempt?.userId ?? user.id}, subscription ${subscriptionId}`,
      );

    try {
      // Call the existing webhook handler logic
      await this.stripeEventsService.handleCheckoutSessionCompleted({
        id: 'recovery-' + Date.now(),
        object: 'event',
        type: 'checkout.session.completed',
        data: { object: session },
        created: Math.floor(Date.now() / 1000),
        livemode: session.livemode,
        pending_webhooks: 0,
        request: null,
        api_version: null,
      } as Stripe.Event);

      // Verify workspace was created
      const workspace = await this.prisma.subscription.findFirst({
        where: { stripeSubscriptionId: subscriptionId },
        select: { workspaceId: true },
      });

      if (workspace) {
        return {
          status: 'completed',
          workspaceId: workspace.workspaceId,
          message: 'Workspace created successfully!',
        };
      } else {
        return {
          status: 'processing',
          message: 'Workspace is being created. Please wait a moment and refresh.',
        };
      }
    } catch (err) {
      this.logger.error(`[RecoverSession] Error creating workspace: ${err.message}`, err.stack);
      return {
        status: 'processing',
        message: 'Setup is in progress. Please wait and try again in a moment.',
      };
    }
  }

  /**
   * Debug endpoint to verify Stripe → DB sync
   * **Internal use only - not for production**
   */
  @Get('debug/:workspaceId')
  @ApiExcludeEndpoint() // Exclude from Swagger - internal debug endpoint
  @SuperAdmin() // Internal-only: allow studio admins/super admins
  async getDebugInfo(@Param('workspaceId') workspaceId: string): Promise<any> {
    if (!isStripeConfigured()) {
      throw new BadRequestException('Stripe is not configured');
    }

    // Get subscription and workspace context from database
    const subscription = await this.prisma.subscription.findUnique({
      where: { workspaceId },
      include: {
        workspace: {
          select: { id: true, name: true, slug: true },
        },
      },
    });

    if (!subscription) {
      throw new BadRequestException(`No subscription found for workspace ${workspaceId}`);
    }

    // Get latest day credits
    const dayCredits = await this.prisma.dayCredit.findFirst({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
    });

    // Get latest AI credits
    const aiCredits = await this.prisma.aICredit.findFirst({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
    });

    // Determine if workspace is locked
    const workspaceLocked =
      subscription.status === SubscriptionStatus.PAUSED ||
      subscription.status === SubscriptionStatus.PAST_DUE;

    // Fetch Stripe subscription if we have ID
    let stripeStatus: string | null = null;
    let stripeSubscription: Stripe.Subscription | null = null;
    if (subscription.stripeSubscriptionId) {
      try {
        const stripe = this.getStripe();
        stripeSubscription = await stripe.subscriptions.retrieve(
          subscription.stripeSubscriptionId,
        );
        stripeStatus = stripeSubscription.status;
      } catch (error) {
        this.logger.error(`Failed to fetch Stripe subscription: ${error.message}`);
        stripeStatus = 'ERROR_FETCHING';
      }
    }

    // Check if workspace is eligible for credit burn today
    const burnEligibility = await this.dayCreditBurnService.isBurnEligibleToday(workspaceId);

    return {
      workspace: {
        id: subscription.workspace?.id ?? workspaceId,
        name: subscription.workspace?.name ?? null,
        slug: subscription.workspace?.slug ?? null,
      },
      subscription: {
        id: subscription.id,
        status: subscription.status,
        planCode: subscription.planCode,
        mode: subscription.mode,
        stripeSubscriptionId: subscription.stripeSubscriptionId,
        billingPeriodStart: subscription.billingPeriodStart,
        billingPeriodEnd: subscription.billingPeriodEnd,
        cancelAt: subscription.cancelAt,
        lastDayCreditBurnAt: subscription.lastDayCreditBurnAt,
        activeTaskLimit: subscription.activeTaskLimit,
        slaSeconds: subscription.slaSeconds,
      },
      dayCredits: dayCredits
        ? {
          id: dayCredits.id,
          totalCredits: dayCredits.totalCredits,
          usedCredits: dayCredits.usedCredits,
          remaining: dayCredits.totalCredits - dayCredits.usedCredits,
          periodStart: dayCredits.periodStart,
          periodEnd: dayCredits.periodEnd,
        }
        : null,
      aiCredits: aiCredits
        ? {
          id: aiCredits.id,
          totalCredits: aiCredits.totalCredits,
          usedCredits: aiCredits.usedCredits,
          remaining: aiCredits.totalCredits - aiCredits.usedCredits,
          periodStart: aiCredits.periodStart,
          periodEnd: aiCredits.periodEnd,
        }
        : null,
      burnEligibility: {
        isEligible: burnEligibility.eligible,
        reason: burnEligibility.reason,
        lastBurnAt: subscription.lastDayCreditBurnAt,
      },
      stripe: stripeSubscription
        ? {
          id: stripeSubscription.id,
          status: stripeSubscription.status,
          currentPeriodStart: new Date(
            (stripeSubscription as any).current_period_start * 1000,
          ),
          currentPeriodEnd: new Date(
            (stripeSubscription as any).current_period_end * 1000,
          ),
          cancelAt: stripeSubscription.cancel_at
            ? new Date(stripeSubscription.cancel_at * 1000)
            : null,
          items: stripeSubscription.items.data.map((item) => ({
            price: item.price.id,
            product:
              typeof item.price.product === 'string'
                ? item.price.product
                : item.price.product?.id,
            interval: item.price.recurring?.interval,
          })),
        }
        : null,
      sync: {
        hasStripeId: !!subscription.stripeSubscriptionId,
        statusMatch:
          stripeStatus === null ||
          this.mapStripeStatusToInternal(stripeStatus) === subscription.status,
        hasDayCredits: !!dayCredits,
        hasAiCredits: !!aiCredits,
        workspaceLocked,
      },
    };
  }

  /**
   * Map Stripe status to internal status for comparison
   */
  private mapStripeStatusToInternal(stripeStatus: string): SubscriptionStatus {
    switch (stripeStatus) {
      case 'active':
      case 'trialing':
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

  /**
   * Create Checkout Session
   * Creates a Stripe Checkout session for subscription purchase
   */
  @Post('create-checkout-session')
  @ApiOperation({
    summary: 'Create Stripe Checkout session for subscription',
    description: 'Creates a Stripe Checkout session for purchasing a subscription. Requires a valid priceId from Stripe (configured in Stripe Dashboard with planCode metadata). The workspace must not already have an active subscription. Returns a checkout URL that the user should be redirected to.',
  })
  @ApiResponse({
    status: 201,
    description: 'Checkout session created successfully',
    schema: {
      properties: {
        sessionId: { type: 'string', example: 'cs_test_...' },
        url: { type: 'string', example: 'https://checkout.stripe.com/c/pay/cs_test_...' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid request (workspace not found, already has subscription, or Stripe not configured)' })
  @BypassWorkspaceMember()
  async createCheckoutSession(
    @Body() dto: CreateCheckoutSessionDto,
    @Headers('x-workspace-id') workspaceId: string | undefined,
    @Req() req: any, // Assuming auth middleware attaches user
  ): Promise<{ sessionId: string; url: string }> {
    // Workspace header is optional for new signups that don't have a workspace yet.
    // If a workspaceId is passed, we link it for upgrades; otherwise we rely on the authenticated user.
    const user = req.user; // Assuming AuthGuard populates this
    // We need to ensure we have user info. If not authenticated, we can't proceed.
    // But wait, the prompt says "User signs up via Clerk". So they are authenticated.

    // For now, let's assume we might or might not have workspaceId.

    if (!isStripeConfigured()) {
      throw new BadRequestException('Stripe is not configured. Please set STRIPE_PUBLISHABLE_KEY, STRIPE_SECRET_KEY, and STRIPE_WEBHOOK_SECRET environment variables.');
    }

    const billingInterval = dto.billingInterval === BillingInterval.YEARLY
      ? BillingInterval.YEARLY
      : BillingInterval.MONTHLY;

    const normalizedPlanCode = normalizePlanCode(dto.planCode);
    if (!normalizedPlanCode) {
      this.logger.error(`Invalid planCode provided planCode=${dto.planCode}`);
      throw new BadRequestException('Invalid planCode');
    }

    const priceId = getPriceIdForPlan(normalizedPlanCode, billingInterval, this.configService);
    if (!priceId) {
      this.logger.error(`Missing price id for planCode=${normalizedPlanCode} billingInterval=${billingInterval}`);
      throw new BadRequestException('Invalid planCode or billingInterval');
    }

    const planKey = `${normalizedPlanCode}_${billingInterval}`;
    const planVariant = getPlanVariantByKey(planKey, this.configService);
    if (!planVariant) {
      this.logger.error(`Unable to resolve plan variant for planKey=${planKey}`);
      throw new BadRequestException('Invalid planCode or billingInterval');
    }

    this.logger.log(`Creating checkout session for plan ${planKey} (price: ${priceId})`);

    const stripe = this.getStripe();

    // Get or create customer
    // Ideally we should have a mapping. For now, we'll search by email if we have user info.
    let customerId: string | undefined;

    // If we have a user, try to find their customer ID
    if (user?.email) {
      const customers = await stripe.customers.search({
        query: `email:'${user.email}'`,
        limit: 1,
      });
      if (customers.data.length > 0) {
        customerId = customers.data[0].id;
      } else {
        // Create customer
        const customer = await stripe.customers.create({
          email: user.email,
          name: user.name,
          metadata: {
            userId: user.id,
          }
        });
        customerId = customer.id;
      }
    }

    if (!user?.id) {
      throw new BadRequestException('Authenticated user is required to start checkout');
    }

    // Create CheckoutAttempt with unique placeholder session id so metadata can reference it
    // Some environments might not have the table yet; fail soft so checkout can proceed.
    let attemptId: string | null = null;
    let placeholderSessionId: string | null = null;
    try {
      placeholderSessionId = `PENDING-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const attempt = await this.prisma.checkoutAttempt.create({
        data: {
          userId: user.id,
          email: user?.email,
          workspaceId: workspaceId || null,
          planKey,
          stripeSessionId: placeholderSessionId,
          status: 'PENDING',
        }
      });
      attemptId = attempt.id;
    } catch (err) {
      this.logger.warn(`checkoutAttempt table unavailable; proceeding without persistence: ${err.message}`);
    }

    // Create checkout session
    const metadata: Record<string, string> = {
      planCode: planVariant.planCode,
      legacyPlanCode: normalizedPlanCode,
      billingInterval,
      planKey,
    };
    if (attemptId) {
      metadata.checkoutAttemptId = attemptId;
    }

    if (user?.id) {
      metadata.userId = user.id;
    }
    if (user?.email) {
      metadata.email = user.email;
    }
    if (workspaceId) {
      metadata.workspaceId = workspaceId;
    }

    const sessionPayload: Stripe.Checkout.SessionCreateParams = {
      mode: 'subscription',
      client_reference_id: user?.id,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: dto.successUrl,
      cancel_url: dto.cancelUrl,
      metadata,
      subscription_data: {
        metadata,
      }
    };

    if (customerId) {
      sessionPayload.customer = customerId;
    } else {
      // If no user/customer (shouldn't happen if auth is required), let Stripe collect email
      sessionPayload.customer_email = user?.email;
    }

    const session = await stripe.checkout.sessions.create(sessionPayload);

    if (!session.url) {
      throw new BadRequestException('Failed to create checkout session: no URL returned');
    }

    // Update attempt with session ID
    if (attemptId) {
      try {
        await this.prisma.checkoutAttempt.update({
          where: { id: attemptId },
          data: {
            stripeSessionId: session.id,
            stripeCustomerId: customerId || null,
            workspaceId: workspaceId || null,
          }
        });
      } catch (err) {
        this.logger.warn(`checkoutAttempt update skipped; table unavailable: ${err.message}`);
      }
    }

    return {
      sessionId: session.id,
      url: session.url,
    };
  }

  /**
   * Create Composer Pro Checkout Session
   * Specialized checkout for Composer-only users upgrading to Pro
   * Creates workspace if user doesn't have one
   */
  @Post('composer-checkout')
  @ApiOperation({
    summary: 'Create Composer Pro checkout session',
    description: 'Creates a Stripe checkout session specifically for Composer Pro subscription. Will create a workspace if user does not have one.',
  })
  @ApiResponse({ status: 201, description: 'Checkout session created', schema: { properties: { sessionId: { type: 'string' }, url: { type: 'string' } } } })
  @BypassWorkspaceMember()
  async createComposerCheckout(
    @Body() dto: CreateComposerCheckoutDto,
    @CurrentUser() user: AuthUser,
  ): Promise<{ sessionId: string; url: string }> {
    if (!isStripeConfigured()) {
      throw new BadRequestException('Stripe is not configured');
    }

    if (!user?.id || !user?.email) {
      throw new BadRequestException('Authenticated user with email is required');
    }

    const billingInterval = dto.billingInterval === BillingInterval.YEARLY
      ? BillingInterval.YEARLY
      : BillingInterval.MONTHLY;

    // TODO: COMPOSER_PRO is NOT ENABLED IN V1
    // To enable, create Stripe products and set env vars (see docs/STRIPE_ENV_VARS.md)
    // Then enable COMPOSER_PRO in the external sako-composer app configuration
    const planCode = 'COMPOSER_PRO';
    const planKey = `${planCode}_${billingInterval}`;
    const priceId = getPriceIdForPlan(planCode, billingInterval, this.configService);

    if (!priceId) {
      this.logger.error(`Missing price id for Composer Pro ${billingInterval}`);
      throw new BadRequestException(
        'Composer Pro is not available yet. ' +
        'To enable: create Stripe products and set STRIPE_PRICE_ID_COMPOSER_PRO_MONTHLY and STRIPE_PRICE_ID_COMPOSER_PRO_YEARLY environment variables. ' +
        'See docs/STRIPE_ENV_VARS.md for details.'
      );
    }

    this.logger.log(`Creating Composer checkout session for user ${user.id}, plan ${planKey}`);

    // Check if user already has a workspace
    const dbUser = await this.prisma.user.findFirst({
      where: { 
        OR: [
          { id: user.id },
          { clerkUserId: user.id },
        ]
      },
      include: {
        memberships: {
          include: { workspace: true },
          take: 1,
        },
      },
    });

    let workspaceId: string | undefined;
    if (dbUser?.memberships?.[0]?.workspace) {
      workspaceId = dbUser.memberships[0].workspace.id;
    }

    const stripe = this.getStripe();

    // Get or create Stripe customer
    let customerId: string;
    const customers = await stripe.customers.search({
      query: `email:'${user.email}'`,
      limit: 1,
    });

    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    } else {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.name,
        metadata: { userId: user.id },
      });
      customerId = customer.id;
    }

    // Metadata for webhook processing
    const metadata: Record<string, string> = {
      planCode,
      billingInterval,
      planKey,
      userId: user.id,
      email: user.email,
      isComposerCheckout: 'true',
    };

    if (workspaceId) {
      metadata.workspaceId = workspaceId;
    }

    if (dto.workspaceName) {
      metadata.workspaceName = dto.workspaceName;
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      client_reference_id: user.id,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: dto.successUrl,
      cancel_url: dto.cancelUrl,
      metadata,
      subscription_data: { metadata },
    });

    if (!session.url) {
      throw new BadRequestException('Failed to create checkout session');
    }

    return {
      sessionId: session.id,
      url: session.url,
    };
  }

  /**
   * Create Billing Portal Session
   * Creates a session for customers to manage their subscription
   */
  @Post('create-portal-session')
  @ApiOperation({
    summary: 'Create Stripe Billing Portal session',
    description: 'Creates a Stripe Billing Portal session that allows customers to manage their subscription, update payment methods, view invoices, and cancel their subscription. The workspace must have an active subscription with a Stripe customer ID.',
  })
  @ApiSecurity('workspace-header')
  @ApiResponse({
    status: 201,
    description: 'Portal session created successfully',
    schema: {
      properties: {
        url: { type: 'string', example: 'https://billing.stripe.com/session/...' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid request (workspace not found, no subscription, or Stripe not configured)' })
  async createPortalSession(
    @Headers('x-workspace-id') workspaceId: string,
    @Body('returnUrl') returnUrl: string,
  ): Promise<{ url: string }> {
    if (!workspaceId) {
      throw new BadRequestException('x-workspace-id header is required');
    }

    if (!isStripeConfigured()) {
      throw new BadRequestException('Stripe is not configured. Please set STRIPE_PUBLISHABLE_KEY, STRIPE_SECRET_KEY, and STRIPE_WEBHOOK_SECRET environment variables.');
    }

    this.logger.log(`Creating billing portal session for workspace ${workspaceId}`);

    // Fetch workspace subscription with stripe info
    const subscription = await this.prisma.subscription.findUnique({
      where: { workspaceId },
    });

    if (!subscription) {
      throw new BadRequestException('No subscription found for this workspace');
    }

    if (!subscription.stripeSubscriptionId) {
      throw new BadRequestException('Billing portal is unavailable because this workspace does not have a Stripe subscription.');
    }

    const stripe = this.getStripe();

    // Retrieve the subscription from Stripe to get the customer ID
    let customerId: string;
    try {
      const stripeSub = await stripe.subscriptions.retrieve(subscription.stripeSubscriptionId);
      customerId = typeof stripeSub.customer === 'string'
        ? stripeSub.customer
        : stripeSub.customer.id;
    } catch (error) {
      this.logger.error(`Failed to retrieve Stripe subscription ${subscription.stripeSubscriptionId}: ${error.message}`);
      throw new BadRequestException(`Failed to verify subscription with payment provider: ${error.message}`);
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl || `${process.env.FRONTEND_URL}/settings/billing`,
    });

    return {
      url: session.url,
    };
  }

  /**
   * Create Checkout Session with Promo Code
   * Used by Day-5 marketing email to apply discount and redirect to checkout.
   * Bypasses the pricing table to guarantee promo code works.
   */
  @Post('create-checkout-session-redeem')
  @Public()
  @BypassWorkspaceMember()
  @ApiOperation({
    summary: 'Create checkout session with promo code redemption',
    description: 'Validates a marketing promo code and creates a Stripe checkout session with the discount applied. Used for marketing email "Redeem Discount" buttons.',
  })
  @ApiResponse({
    status: 201,
    description: 'Checkout session created with discount',
    schema: {
      properties: {
        url: { type: 'string', example: 'https://checkout.stripe.com/...' },
        sessionId: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid promo code or Stripe not configured' })
  async createCheckoutSessionRedeem(
    @Body() body: { promoCode: string; priceId?: string; successUrl?: string; cancelUrl?: string },
  ): Promise<{ url: string; sessionId: string }> {
    if (!isStripeConfigured()) {
      throw new BadRequestException('Stripe is not configured');
    }

    const { promoCode, priceId, successUrl, cancelUrl } = body;

    if (!promoCode) {
      throw new BadRequestException('promoCode is required');
    }

    // Validate promo code
    const validation = await this.marketingOfferService.validatePromoCode(promoCode);
    if (!validation.valid) {
      throw new BadRequestException(validation.error || 'Invalid promo code');
    }

    const stripe = this.getStripe();
    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'https://app.trysako.com';

    // Use default price if not specified (Core monthly as default)
    const defaultPriceId = this.configService.get<string>('STRIPE_PRICE_ID_CORE_MONTHLY');
    if (!defaultPriceId && !priceId) {
      throw new BadRequestException('No price ID configured. Set STRIPE_PRICE_ID_CORE_MONTHLY environment variable.');
    }
    const finalPriceId = priceId || defaultPriceId!;

    // Create checkout session with discount applied
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: finalPriceId, quantity: 1 }],
      discounts: [{ promotion_code: validation.promotionCodeId }],
      success_url: successUrl || `${frontendUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl || `${frontendUrl}/pricing`,
      metadata: {
        source: 'marketing_redeem',
        promoCode,
      },
    });

    if (!session.url) {
      throw new BadRequestException('Failed to create checkout session');
    }

    this.logger.log(`Created redeem checkout session ${session.id} with promo ${promoCode}`);

    return {
      url: session.url,
      sessionId: session.id,
    };
  }
}
