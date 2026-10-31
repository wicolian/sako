import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { WorkspaceNotFoundException } from '../common/exceptions/business.exceptions';
import { Prisma, TaskStatus } from '@prisma/client';
import * as Sentry from '@sentry/nestjs';
import { getPlanVariantByKey, buildPlanDefinitions, PlanDefinition, BillingInterval, hasStudioAccess, PlanCode } from '../billing/plan.config';
import { DayCreditBurnService } from '../credits/day-credit-burn.service';
import { NotificationService } from '../common/notifications/notification.service';

@Injectable()
export class WorkspaceService {
  private readonly logger = new Logger(WorkspaceService.name);
  constructor(
    private prisma: PrismaService,
    private dayCreditBurnService: DayCreditBurnService,
    private configService: ConfigService,
    private notificationService: NotificationService,
  ) { }

  /**
   * Get workspace details with subscription, plan, and derived limits
   * Optimized to minimize database queries by running them in parallel
   */
  async getWorkspaceDetails(workspaceId: string) {
    const now = new Date();

    // Run workspace query and credits fetch in parallel for better performance
    const [workspace, creditsResult] = await Promise.all([
      this.prisma.workspace.findUnique({
        where: { id: workspaceId },
        include: {
          plan: true,
          subscription: true,
          planOverride: true,
          slackIntegrations: true,
        },
      }),
      this.fetchCredits(workspaceId, now),
    ]);

    if (!workspace) {
      throw new WorkspaceNotFoundException(workspaceId);
    }

    // Calculate derived values
    const activeTaskLimit = this.getEffectiveActiveTaskLimit(workspace);
    const slaSeconds = this.getEffectiveSlaSeconds(workspace);

    // Count tasks by status using a single optimized query
    const [activeTasksCount, queuedTasksCount] = await Promise.all([
      this.prisma.task.count({
        where: { workspaceId, status: TaskStatus.IN_PROGRESS },
      }),
      this.prisma.task.count({
        where: { workspaceId, status: TaskStatus.QUEUED },
      }),
    ]);

    // Ensure credits exist for this billing period (self-heal missing records)
    const variant = this.resolvePlanVariantForWorkspace(workspace);
    let { dayCredits, aiCredits } = creditsResult.dayCredits.length > 0 && creditsResult.aiCredits.length > 0
      ? creditsResult
      : await this.ensureCreditsForWorkspace(workspace, variant);

    // Auto-burn a day credit if it hasn't been burned yet today (self-heal if cron missed)
    try {
      const burned = await this.dayCreditBurnService.burnDayCreditForWorkspace(workspace.id);
      if (burned) {
        const refreshedCredits = await this.fetchCredits(workspace.id, now);
        dayCredits = refreshedCredits.dayCredits;
        aiCredits = refreshedCredits.aiCredits;
      }
    } catch (error) {
      // Do not block workspace load if burn fails; log for investigation
      this.logger.error(`Failed to auto-burn day credit for workspace ${workspace.id}`, error instanceof Error ? error.stack : undefined);
    }

    // Find the active day credit for right now (using 'now' from the top of the function)
    const currentDayCredit = dayCredits.find(dc => dc.periodStart <= now && dc.periodEnd >= now) || dayCredits[0] || null;
    
    // Find the active AI credit for right now
    const currentAiCredit = aiCredits.find(ac => ac.periodStart <= now && ac.periodEnd >= now) || aiCredits[0] || null;
    
    // Determine plan capabilities based on subscription plan code
    const planCode = (workspace.subscription?.planCode || 'COMPOSER_FREE') as PlanCode;
    const studioAccess = hasStudioAccess(planCode);

    return {
      workspace: {
        id: workspace.id,
        name: workspace.name,
        slug: workspace.slug,
        timezone: workspace.timezone,
        hasOnboarded: workspace.hasOnboarded,
        createdAt: workspace.createdAt,
        updatedAt: workspace.updatedAt,
      },
      plan: workspace.plan,
      subscription: workspace.subscription,
      slackIntegration: workspace.slackIntegrations?.[0] || null,
      derived: {
        activeTaskLimit,
        effectiveSlaSeconds: slaSeconds,
      },
      counts: {
        activeTasks: activeTasksCount,
        queuedTasks: queuedTasksCount,
      },
      // Plan capability flags for frontend gating
      planCapabilities: {
        planType: planCode,
        hasStudioAccess: studioAccess,
        hasComposerAccess: true, // All plans have Composer access
        canSendComposerToStudio: studioAccess,
        isComposerUnlimited: studioAccess,
      },
      // Composer-specific credit info
      composerCredits: {
        remaining: currentAiCredit ? currentAiCredit.totalCredits - currentAiCredit.usedCredits : 0,
        total: currentAiCredit?.totalCredits ?? 0,
        isUnlimited: studioAccess,
        resetDate: currentAiCredit?.periodEnd ?? null,
      },
      currentDayCredit: currentDayCredit ? {
        total: currentDayCredit.totalCredits,
        used: currentDayCredit.usedCredits,
        remaining: currentDayCredit.totalCredits - currentDayCredit.usedCredits,
        periodStart: currentDayCredit.periodStart,
        periodEnd: currentDayCredit.periodEnd,
      } : null,
      credits: {
        dayCredits: dayCredits.map((dc) => ({
          total: dc.totalCredits,
          used: dc.usedCredits,
          remaining: dc.totalCredits - dc.usedCredits,
          periodStart: dc.periodStart,
          periodEnd: dc.periodEnd,
        })),
        aiCredits: aiCredits.map((ac) => ({
          total: ac.totalCredits,
          used: ac.usedCredits,
          remaining: ac.totalCredits - ac.usedCredits,
          periodStart: ac.periodStart,
          periodEnd: ac.periodEnd,
        })),
      },
    };
  }

  /**
   * Get effective active task limit for workspace
   * Rule: ENTERPRISE override > plan default
   */
  getEffectiveActiveTaskLimit(workspace: any): number {
    // Check for plan override first (enterprise clients)
    if (workspace.planOverride?.customActiveTaskLimit != null) {
      return workspace.planOverride.customActiveTaskLimit;
    }
    if (workspace.subscription?.activeTaskLimit != null) {
      return workspace.subscription.activeTaskLimit;
    }
    return workspace.plan?.activeTaskLimit ?? 1;
  }

  /**
   * Get effective SLA seconds for workspace
   * Rule: plan override > subscription override > default 48h
   */
  getEffectiveSlaSeconds(workspace: any): number {
    // Check for plan override first (enterprise clients)
    if (workspace.planOverride?.customTatSeconds != null) {
      return workspace.planOverride.customTatSeconds;
    }
    if (workspace.subscription?.slaSeconds != null) {
      return workspace.subscription.slaSeconds;
    }
    return 172800; // 48 hours default
  }

  /**
   * Get workspace with full context (used by other services)
   */
  async getWorkspaceWithContext(workspaceId: string) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        plan: true,
        subscription: true,
      },
    });

    if (!workspace) {
      throw new WorkspaceNotFoundException(workspaceId);
    }

    return workspace;
  }

  private resolvePlanVariantForWorkspace(workspace: any): PlanDefinition | null {
    const planCode = (workspace.subscription?.planCode || workspace.plan?.code) as any;
    if (!planCode) return null;

    let interval: BillingInterval = BillingInterval.MONTHLY;
    if (workspace.subscription?.billingPeriodStart && workspace.subscription?.billingPeriodEnd) {
      const start = new Date(workspace.subscription.billingPeriodStart);
      const end = new Date(workspace.subscription.billingPeriodEnd);
      const diffDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
      if (diffDays > 200) {
        interval = BillingInterval.YEARLY;
      }
    }

    const key = `${planCode}_${interval}`;
    return getPlanVariantByKey(key, this.configService);
  }

  private calculateBillingPeriod(plan: PlanDefinition, startOverride?: Date | string, endOverride?: Date | string) {
    const start = startOverride ? new Date(startOverride) : new Date();
    let end: Date;

    if (endOverride) {
      end = new Date(endOverride);
    } else {
      end = new Date(start);
      if (plan.billingInterval === BillingInterval.YEARLY) {
        end.setFullYear(end.getFullYear() + 1);
      } else {
        end.setMonth(end.getMonth() + 1);
      }
    }

    return { start, end };
  }

  private async ensureCreditsForWorkspace(workspace: any, variant: PlanDefinition | null) {
    const now = new Date();
    let { dayCredits, aiCredits } = await this.fetchCredits(workspace.id, now);

    const allowProvision = !workspace.subscription?.status ||
      ['ACTIVE', 'CANCEL_AT_PERIOD_END', 'PAST_DUE'].includes(workspace.subscription.status);

    if (allowProvision && (!dayCredits.length || !aiCredits.length) && variant) {
      let { start, end } = this.calculateBillingPeriod(
        variant,
        workspace.subscription?.billingPeriodStart,
        workspace.subscription?.billingPeriodEnd,
      );

      // If stored period is malformed (end <= start), fall back to computed cycle length
      if (end <= start) {
        const recalculated = this.calculateBillingPeriod(variant, workspace.subscription?.billingPeriodStart);
        start = recalculated.start;
        end = recalculated.end;
      }

      await this.prisma.$transaction(async (tx) => {
        await this.ensureCreditsForPeriod(tx, workspace.id, variant, start, end);
      }).catch(() => null);

      const refreshed = await this.fetchCredits(workspace.id, now);
      dayCredits = refreshed.dayCredits;
      aiCredits = refreshed.aiCredits;
    }

    return { dayCredits, aiCredits };
  }

  private async fetchCredits(workspaceId: string, now: Date) {
    const dayCredits = await this.prisma.dayCredit.findMany({
      where: {
        workspaceId,
        periodEnd: { gte: now },
      },
      orderBy: { periodEnd: 'asc' },
    });

    const aiCredits = await this.prisma.aICredit.findMany({
      where: {
        workspaceId,
        periodEnd: { gte: now },
      },
      orderBy: { periodEnd: 'asc' },
    });

    return { dayCredits, aiCredits };
  }

  private async ensureCreditsForPeriod(
    tx: Prisma.TransactionClient,
    workspaceId: string,
    variant: PlanDefinition,
    periodStart: Date,
    periodEnd: Date,
  ) {
    const existingDay = await tx.dayCredit.findFirst({
      where: { workspaceId, periodStart, periodEnd },
    });
    if (!existingDay) {
      await tx.dayCredit.create({
        data: {
          workspaceId,
          totalCredits: variant.dayCreditsPerCycle,
          usedCredits: 0,
          periodStart,
          periodEnd,
        },
      });
    }

    const existingAi = await tx.aICredit.findFirst({
      where: { workspaceId, periodStart, periodEnd },
    });
    if (!existingAi) {
      await tx.aICredit.create({
        data: {
          workspaceId,
          totalCredits: variant.aiCreditsPerCycle,
          usedCredits: 0,
          periodStart,
          periodEnd,
        },
      });
    }
  }

  /**
   * Get workspace metrics (SLA, FPAR)
   */
  async getMetrics(workspaceId: string) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // 1. Tasks completed in last 30 days
    const completedTasks = await this.prisma.task.findMany({
      where: {
        workspaceId,
        status: TaskStatus.COMPLETED,
        completedAt: { gte: thirtyDaysAgo },
      },
      select: {
        id: true,
        createdAt: true,
        inProgressAt: true,
        completedAt: true,
        revisionNumber: true,
      },
    });

    const tasksCompletedLast30Days = completedTasks.length;

    // 2. Average SLA (Turnaround Time)
    let totalSlaSeconds = 0;
    let slaCount = 0;
    let firstPassCount = 0;

    for (const t of completedTasks) {
      if (t.inProgressAt && t.completedAt) {
        const duration = (t.completedAt.getTime() - t.inProgressAt.getTime()) / 1000;
        totalSlaSeconds += duration;
        slaCount++;
      }
      if (t.revisionNumber === 0) {
        firstPassCount++;
      }
    }

    // Calculate average turnaround (with 1 decimal place precision)
    const averageTurnaroundHours = slaCount > 0 && !isNaN(totalSlaSeconds)
      ? Math.round((totalSlaSeconds / slaCount) / 3600 * 10) / 10
      : null;

    // Calculate FPAR as 0-100 percentage, clamped
    const rawFpar = tasksCompletedLast30Days > 0
      ? Math.round((firstPassCount / tasksCompletedLast30Days) * 100)
      : null;

    const firstPassAcceptanceRate = rawFpar !== null
      ? Math.min(100, Math.max(0, rawFpar))
      : null;

    return {
      tasksCompletedLast30Days,
      averageTurnaroundHours, // Renamed from averageSlaHours to match frontend
      firstPassAcceptanceRate, // Already 0-100, don't multiply again in frontend
      revisionRate: null, // Placeholder for future
    };
  }

  /**
   * Get workspace members with their user info
   */
  async getMembers(workspaceId: string) {
    const members = await this.prisma.workspaceMember.findMany({
      where: { workspaceId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Get seat limit info
    const workspace = await this.getWorkspaceWithContext(workspaceId);
    const planCode = workspace.plan?.code || workspace.subscription?.planCode;
    const mode = workspace.subscription?.mode;

    let seatLimit = 2;
    // Find any variant matching the plan code to get seats
    const planDefinitions = buildPlanDefinitions(this.configService);
    const variant = Object.values(planDefinitions).find((v) => v.planCode === planCode);
    if (variant) {
      seatLimit = variant.seats;
    } else if (workspace.subscription?.planCode) {
      // Fallback to plan config if available
      // We might need to guess the variant or just pick monthly as default for limits
      const planKey = workspace.subscription.planCode + '_MONTHLY';
      const fallbackVariant = getPlanVariantByKey(planKey, this.configService);
      if (fallbackVariant) {
        seatLimit = fallbackVariant.seats;
      }
    }
    return {
      members: members.map(m => ({
        id: m.id,
        role: m.role,
        joinedAt: m.createdAt,
        user: m.user,
      })),
      seatLimit,
      seatsUsed: members.length,
      seatsAvailable: Math.max(0, seatLimit - members.length),
    };
  }

  /**
   * Invite member with seat limit check and email notification
   */
  async inviteMember(workspaceId: string, email: string, roleStr: string = 'MEMBER', inviterUserId?: string) {
    const workspace = await this.getWorkspaceWithContext(workspaceId);

    // Get seat limit (Plan default or override)
    // Core: 2, Ops: 4, Enterprise: 5+
    let seatLimit = 2; // Fallback
    const planCode = workspace.plan?.code || workspace.subscription?.planCode;

    const planDefinitions = buildPlanDefinitions(this.configService);
    const variant = Object.values(planDefinitions).find((v) => v.planCode === planCode);
    if (variant) {
      seatLimit = variant.seats;
    }

    // Count current members
    const currentMembers = await this.prisma.workspaceMember.count({
      where: { workspaceId },
    });

    if (currentMembers >= seatLimit) {
      throw new BadRequestException('You have reached your seat limit (' + currentMembers + ' / ' + seatLimit + '). Upgrade your plan to add more team members.');
    }

    // Check if user exists
    let user = await this.prisma.user.findUnique({ where: { email } });
    const isNewUser = !user;

    // If not, create placeholder (simple invite flow)
    if (!user) {
      user = await this.prisma.user.create({
        data: { email, name: email.split('@')[0] }, // Temporary name
      });
    }

    // Add member
    // Check if already member
    const existingMember = await this.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: { workspaceId, userId: user.id },
      },
    });

    if (existingMember) {
      throw new BadRequestException('User is already a member of this workspace');
    }

    // Map roleStr to valid WorkspaceRole
    let role: 'OWNER' | 'SUBMITTER' | 'MEMBER' | 'VIEWER' = 'MEMBER';
    if (roleStr === 'OWNER' || roleStr === 'SUBMITTER' || roleStr === 'VIEWER') {
      role = roleStr;
    }

    const member = await this.prisma.workspaceMember.create({
      data: {
        workspaceId,
        userId: user.id,
        role,
      },
    });

    // Get inviter info for email
    let inviterName = 'A team member';
    if (inviterUserId) {
      const inviter = await this.prisma.user.findUnique({ where: { id: inviterUserId } });
      if (inviter) {
        inviterName = inviter.name || inviter.email.split('@')[0];
      }
    }

    // Send invitation email + in-app notification if user exists
    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'https://app.trysako.com';
    const inviteUrl = `${frontendUrl}/sign-in`;

    try {
      // Direct email (works even if user record is new)
      await this.notificationService.sendDirectEmail(email, 'WORKSPACE_INVITE', {
        workspaceName: workspace.name,
        inviterName,
        inviteUrl,
      });

      // If the user already exists, also create an in-app notification honoring preferences
      if (!isNewUser && user?.id) {
        await this.notificationService.notifyWorkspaceInvite(user.id, workspace.id, workspace.name, inviterName);
      }

      this.logger.log(`Sent invitation to ${email} for workspace ${workspace.name} (userId=${user?.id || 'new-user'})`);
    } catch (err) {
      this.logger.error(`Failed to send invitation to ${email}: ${err}`);
      // Don't fail the invitation if email fails
    }

    return { ...member, emailSent: true };
  }

  /**
   * Remove member from workspace
   */
  async removeMember(workspaceId: string, memberId: string) {
    const member = await this.prisma.workspaceMember.findUnique({
      where: { id: memberId },
      include: { user: true },
    });

    if (!member) {
      throw new BadRequestException('Member not found');
    }

    if (member.workspaceId !== workspaceId) {
      throw new BadRequestException('Member does not belong to this workspace');
    }

    // Prevent removing OWNER
    if (member.role === 'OWNER') {
      throw new BadRequestException('Cannot remove workspace owner');
    }

    await this.prisma.workspaceMember.delete({
      where: { id: memberId },
    });

    return { success: true, message: 'Removed ' + member.user.email + ' from workspace' };
  }

  /**
   * Update member role
   */
  async updateMemberRole(workspaceId: string, memberId: string, roleStr: string) {
    const member = await this.prisma.workspaceMember.findUnique({
      where: { id: memberId },
    });

    if (!member) {
      throw new BadRequestException('Member not found');
    }

    if (member.workspaceId !== workspaceId) {
      throw new BadRequestException('Member does not belong to this workspace');
    }

    // Validate role - must match WorkspaceRole enum in schema
    const validRoles = ['OWNER', 'SUBMITTER', 'MEMBER', 'VIEWER'];
    if (!validRoles.includes(roleStr)) {
      throw new BadRequestException(`Invalid role. Must be one of: ${validRoles.join(', ')}`);
    }

    // If demoting OWNER, ensure there is at least one other OWNER
    if (member.role === 'OWNER' && roleStr !== 'OWNER') {
      const ownerCount = await this.prisma.workspaceMember.count({
        where: { workspaceId, role: 'OWNER' },
      });
      if (ownerCount <= 1) {
        throw new BadRequestException('Cannot change role of the last OWNER. Promote another member first.');
      }
    }

    const updated = await this.prisma.workspaceMember.update({
      where: { id: memberId },
      data: { role: roleStr as any },
    });

    return updated;
  }

  /**
   * Bootstrap workspace for user from CheckoutAttempt
   * Self-healing mechanism if webhook missed creating workspace
   */
  async bootstrapWorkspaceForUser(userId: string): Promise<{ workspaceId: string } | null> {
    console.log('[BootstrapWorkspace] Attempting bootstrap for userId=' + userId);

    // Find the latest COMPLETED CheckoutAttempt for this user
    let attempt: any = null;
    try {
      attempt = await this.prisma.checkoutAttempt.findFirst({
        where: {
          userId,
          status: { in: ['COMPLETED', 'PENDING'] as any },
        },
        orderBy: { completedAt: 'desc' },
      });
    } catch (err: any) {
      console.warn(`[BootstrapWorkspace] checkoutAttempt lookup skipped: ${err.message}`);
      return null;
    }

    if (!attempt) {
      console.log('[BootstrapWorkspace] No completed checkout attempt found for user');
      return null;
    }

    console.log('[BootstrapWorkspace] Found CheckoutAttempt id=' + attempt.id + ' planKey=' + attempt.planKey);

    if (attempt.workspaceId) {
      const existingWorkspace = await this.prisma.workspace.findUnique({ where: { id: attempt.workspaceId } });
      if (existingWorkspace) {
        await this.prisma.workspaceMember.upsert({
          where: {
            workspaceId_userId: {
              workspaceId: existingWorkspace.id,
              userId,
            },
          },
          update: { role: 'OWNER' },
          create: {
            workspaceId: existingWorkspace.id,
            userId,
            role: 'OWNER',
          },
        });
        await this.prisma.checkoutAttempt.update({
          where: { id: attempt.id },
          data: {
            workspaceId: existingWorkspace.id,
            completedAt: attempt.completedAt ?? new Date(),
            status: 'COMPLETED',
          },
        }).catch(() => null);
        return { workspaceId: existingWorkspace.id };
      }
    }

    // Check if user already has a workspace membership (race condition check)
    const existingMembership = await this.prisma.workspaceMember.findFirst({
      where: { userId },
    });

    if (existingMembership) {
      console.log('[BootstrapWorkspace] User already has workspace membership, skipping bootstrap');
      await this.prisma.checkoutAttempt.update({
        where: { id: attempt.id },
        data: {
          workspaceId: existingMembership.workspaceId,
          completedAt: attempt.completedAt ?? new Date(),
          status: 'COMPLETED',
        },
      }).catch(() => null);
      return { workspaceId: existingMembership.workspaceId };
    }

    // Resolve plan variant from plan config
    const variant = getPlanVariantByKey(attempt.planKey, this.configService);
    if (!variant) {
      console.error('[BootstrapWorkspace] No plan variant for planKey=' + attempt.planKey);
      return null;
    }

    console.log('[BootstrapWorkspace] Resolved plan variant: ' + variant.planCode);

    // Validate that the plan exists before attempting the transaction to avoid Prisma connect errors
    const plan = await this.prisma.plan.findUnique({
      where: { code: variant.planCode as any },
    });

    if (!plan) {
      const message = `[BootstrapWorkspace] No plan found for code=${variant.planCode}. Did you run prisma seed?`;
      this.logger.error(message);
      Sentry.captureMessage(message);
      throw new BadRequestException(
        `Plan with code '${variant.planCode}' not found. Seed plans with 'npx prisma db seed' inside the API container.`,
      );
    }

    // Get user for workspace naming
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      console.error('[BootstrapWorkspace] User not found: ' + userId);
      return null;
    }

    // Create workspace + subscription + membership in transaction
    return this.prisma.$transaction(async (tx) => {
      // Generate unique slug
      const baseName = user.name || user.email.split('@')[0];
      let slug = baseName.toLowerCase().replace(/[^a-z0-9]/g, '-');

      // Ensure slug uniqueness
      while (await tx.workspace.findUnique({ where: { slug } })) {
        slug = `${slug}-${Math.floor(Math.random() * 10000)}`;
      }

      console.log('[BootstrapWorkspace] Creating workspace with slug: ' + slug);

      const workspace = await tx.workspace.create({
        data: {
          name: `${baseName}'s Workspace`,
          slug,
          timezone: 'UTC',
          planId: plan.id,
        },
      });


      console.log('[BootstrapWorkspace] Created workspace ' + workspace.id);

      // CORE plan now supports both Design + Motion (no mode restriction)
      const mode = null;

      const { start: periodStart, end: periodEnd } = this.calculateBillingPeriod(variant);

      // Create subscription
      const subscription = await tx.subscription.create({
        data: {
          workspaceId: workspace.id,
          planCode: variant.planCode as any,
          mode,
          activeTaskLimit: variant.activeTaskLimit,
          slaSeconds: variant.tatSeconds,
          status: 'ACTIVE',
          billingPeriodStart: periodStart,
          billingPeriodEnd: periodEnd,
          stripeSubscriptionId: attempt.stripeSubscriptionId || 'bootstrap-' + attempt.id,
        },
      });

      console.log('[BootstrapWorkspace] Created subscription ' + subscription.id);

      // Create workspace member with OWNER role
      const member = await tx.workspaceMember.create({
        data: {
          workspaceId: workspace.id,
          userId,
          role: 'OWNER',
        },
      });

      console.log('[BootstrapWorkspace] Created workspaceMember ' + member.id + ' (userId=' + member.userId + ')');

      await this.ensureCreditsForPeriod(tx, workspace.id, variant, periodStart, periodEnd);

      await tx.checkoutAttempt.update({
        where: { id: attempt.id },
        data: {
          workspaceId: workspace.id,
          completedAt: attempt.completedAt ?? new Date(),
          status: 'COMPLETED',
        },
      }).catch(() => null);

      return { workspaceId: workspace.id };
    });
  }

  /**
   * Get day credit history for a workspace
   * Shows burn events, rollovers, and period changes
   */
  async getCreditHistory(workspaceId: string) {
    // Get all day credit records for this workspace
    const dayCredits = await this.prisma.dayCredit.findMany({
      where: { workspaceId },
      orderBy: { periodStart: 'desc' },
      take: 12, // Last 12 billing periods
    });

    // Get subscription for pause history
    const subscription = await this.prisma.subscription.findUnique({
      where: { workspaceId },
    });

    // Calculate rollover info
    const history = dayCredits.map((credit, idx) => {
      const usedCredits = credit.usedCredits;
      const totalCredits = credit.totalCredits;
      const remaining = Math.max(0, totalCredits - usedCredits);
      const burnRate = usedCredits > 0 ? (usedCredits / this.getDaysBetween(credit.periodStart, new Date())) : 0;
      
      // Check for rollover from previous period
      let rolloverCredits = 0;
      const prevPeriod = dayCredits[idx + 1];
      if (prevPeriod) {
        const prevRemaining = prevPeriod.totalCredits - prevPeriod.usedCredits;
        // Simple heuristic: if current totalCredits > expected (30), likely has rollover
        const expectedCredits = 30; // Monthly plan
        if (totalCredits > expectedCredits && prevRemaining > 0) {
          rolloverCredits = Math.min(prevRemaining, totalCredits - expectedCredits);
        }
      }

      return {
        id: credit.id,
        periodStart: credit.periodStart,
        periodEnd: credit.periodEnd,
        totalCredits,
        usedCredits,
        remaining,
        rolloverCredits,
        avgDailyBurn: Math.round(burnRate * 100) / 100,
        isCurrentPeriod: new Date() >= credit.periodStart && new Date() <= credit.periodEnd,
      };
    });

    // Get pause info
    const pauseInfo = subscription ? {
      isPaused: subscription.status === 'PAUSED',
      pausedAt: subscription.pausedAt,
      totalPausedSeconds: subscription.totalPausedSeconds,
      pauseReason: subscription.pauseReason,
    } : null;

    return {
      history,
      pauseInfo,
      summary: {
        currentPeriod: history.find(h => h.isCurrentPeriod) || null,
        totalPeriodsTracked: history.length,
      },
    };
  }

  /**
   * Forecast when credits will run out based on current burn rate
   */
  async getCreditForecast(workspaceId: string) {
    const now = new Date();

    // Get current day credit
    const dayCredit = await this.prisma.dayCredit.findFirst({
      where: {
        workspaceId,
        periodStart: { lte: now },
        periodEnd: { gte: now },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!dayCredit) {
      return {
        hasCredit: false,
        message: 'No active day credit period found',
      };
    }

    const remaining = dayCredit.totalCredits - dayCredit.usedCredits;
    
    // Fixed burn rate: 1 credit per active day (not historical average)
    const dailyBurnRate = 1;
    
    // Days until credits run out (remaining credits = days remaining at 1/day)
    const daysRemaining = remaining;
    const projectedExhaustionDate = new Date(now.getTime() + daysRemaining * 24 * 60 * 60 * 1000);
    
    // Days until period ends
    const periodDaysRemaining = this.getDaysBetween(now, dayCredit.periodEnd);
    
    // Will credits last until period end?
    const willLastUntilPeriodEnd = daysRemaining >= periodDaysRemaining;
    
    // Projected unused credits at period end
    const projectedUnused = remaining - (dailyBurnRate * periodDaysRemaining);

    return {
      hasCredit: true,
      current: {
        total: dayCredit.totalCredits,
        used: dayCredit.usedCredits,
        remaining,
        periodEnd: dayCredit.periodEnd,
      },
      forecast: {
        dailyBurnRate: Math.round(dailyBurnRate * 100) / 100,
        daysRemaining,
        projectedExhaustionDate,
        willLastUntilPeriodEnd,
        projectedUnusedAtPeriodEnd: Math.max(0, Math.floor(projectedUnused)),
        periodDaysRemaining,
      },
      recommendations: this.getCreditRecommendations(remaining, daysRemaining, periodDaysRemaining),
    };
  }

  private getDaysBetween(start: Date, end: Date): number {
    const diffMs = end.getTime() - start.getTime();
    return Math.max(1, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
  }

  private getCreditRecommendations(remaining: number, daysRemaining: number, periodDaysRemaining: number): string[] {
    const recommendations: string[] = [];

    if (remaining <= 3) {
      recommendations.push('⚠️ Low credits: Consider pausing to preserve remaining days.');
    }

    if (daysRemaining < periodDaysRemaining && remaining > 0) {
      recommendations.push(`💡 At current pace, you'll run out ${periodDaysRemaining - daysRemaining} days before period ends.`);
    }

    if (remaining > periodDaysRemaining * 1.5) {
      recommendations.push('✨ On track to have rollover credits for next period.');
    }

    return recommendations;
  }

  /**
   * Get all dashboard data in a single call
   * Combines workspace details, tasks, metrics, forecast, and drafts
   * Optimized to run queries in parallel where possible
   */
  async getDashboardData(workspaceId: string) {
    // Run all dashboard queries in parallel for maximum performance
    const [workspaceDetails, tasks, metrics, forecast, drafts] = await Promise.all([
      this.getWorkspaceDetails(workspaceId),
      this.getDashboardTasks(workspaceId),
      this.getMetrics(workspaceId),
      this.getCreditForecast(workspaceId),
      this.getDashboardDrafts(workspaceId),
    ]);

    return {
      ...workspaceDetails,
      tasks,
      metrics,
      creditForecast: forecast,
      drafts,
    };
  }

  /**
   * Get tasks for the dashboard (active + in review, limited)
   */
  private async getDashboardTasks(workspaceId: string) {
    const tasks = await this.prisma.task.findMany({
      where: {
        workspaceId,
        status: {
          in: [TaskStatus.IN_PROGRESS, TaskStatus.IN_REVIEW, TaskStatus.QUEUED],
        },
      },
      take: 20,
      orderBy: { createdAt: 'desc' },
      include: {
        brand: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Enrich tasks with SLA fields
    return tasks.map(task => {
      const now = new Date();
      let slaRemainingSeconds: number | null = null;
      let slaElapsedSeconds: number | null = null;
      let slaIsLate = false;

      if (task.inProgressAt && task.slaSeconds > 0) {
        const elapsed = (now.getTime() - task.inProgressAt.getTime()) / 1000;
        slaElapsedSeconds = Math.floor(elapsed);
        slaRemainingSeconds = Math.max(0, task.slaSeconds - elapsed);
        slaIsLate = elapsed > task.slaSeconds;
      }

      return {
        id: task.id,
        title: task.title,
        status: task.status,
        category: task.category,
        revisionNumber: task.revisionNumber,
        createdAt: task.createdAt,
        inProgressAt: task.inProgressAt,
        slaSeconds: task.slaSeconds,
        slaRemainingSeconds,
        slaElapsedSeconds,
        slaIsLate,
        brand: task.brand,
      };
    });
  }

  /**
   * Get task drafts for the dashboard (limited to 10)
   */
  private async getDashboardDrafts(workspaceId: string) {
    const drafts = await this.prisma.taskDraft.findMany({
      where: { workspaceId },
      take: 10,
      orderBy: { lastEditedAt: 'desc' },
      select: {
        id: true,
        title: true,
        category: true,
        lastEditedAt: true,
        createdAt: true,
      },
    });

    return drafts;
  }
}
