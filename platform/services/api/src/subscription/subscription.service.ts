import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WorkspaceService } from '../workspace/workspace.service';
import { AnalyticsService } from '../common/analytics/analytics.service';
import { NotificationService } from '../common/notifications/notification.service';
import { SubscriptionStatus, TaskStatus } from '@prisma/client';
import { getStripeClient } from '../common/stripe/stripe-client';

@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);

  constructor(
    private prisma: PrismaService,
    private workspaceService: WorkspaceService,
    private analytics: AnalyticsService,
    private notificationService: NotificationService,
  ) {}

  /**
   * Get subscription details with derived values
   */
  async getSubscription(workspaceId: string) {
    const workspace = await this.workspaceService.getWorkspaceWithContext(workspaceId);

    if (!workspace.subscription) {
      throw new NotFoundException(`No subscription found for workspace ${workspaceId}`);
    }

    const effectiveActiveTaskLimit = this.workspaceService.getEffectiveActiveTaskLimit(workspace);
    const effectiveSlaSeconds = this.workspaceService.getEffectiveSlaSeconds(workspace);

    return {
      subscription: workspace.subscription,
      plan: workspace.plan,
      derived: {
        effectiveActiveTaskLimit,
        effectiveSlaSeconds,
      },
    };
  }

  /**
   * Pause subscription
   * RULE: stress test 3 - hard freeze on pause
   * - Block new task creation (enforced in TaskService)
   * - Block state transitions (enforced in TaskService)
   * - SLA timers stop (via pausedAt timestamp)
   * - Day credits stop burning (checked in day-credit-burn.service)
   * - Pause payment collection in Stripe (void invoices during pause)
   */
  async pauseSubscription(workspaceId: string, reason?: string) {
    this.logger.log(`[pauseSubscription] Request received for workspace ${workspaceId}, reason: ${reason || 'none'}`);
    
    const workspace = await this.workspaceService.getWorkspaceWithContext(workspaceId);

    if (!workspace.subscription) {
      throw new NotFoundException(`No subscription found for workspace ${workspaceId}`);
    }

    this.logger.log(`[pauseSubscription] Current subscription status: ${workspace.subscription.status}`);

    // Idempotent: if already paused, return current state with info
    if (workspace.subscription.status === SubscriptionStatus.PAUSED) {
      this.logger.log(`Workspace ${workspaceId} is already paused (idempotent call)`);
      return {
        subscription: workspace.subscription,
        message: 'Subscription is already paused.',
        alreadyPaused: true,
      };
    }

    // If cancel_at_period_end is set, we need to clear it first before pausing
    // Otherwise Stripe may reject the pause_collection update
    if (workspace.subscription.status === SubscriptionStatus.CANCEL_AT_PERIOD_END) {
      this.logger.log(`[pauseSubscription] Subscription is set to cancel at period end, clearing that first`);
      if (workspace.subscription.stripeSubscriptionId) {
        try {
          const stripe = getStripeClient();
          await stripe.subscriptions.update(workspace.subscription.stripeSubscriptionId, {
            cancel_at_period_end: false,
          });
          this.logger.log(`[pauseSubscription] Cleared cancel_at_period_end in Stripe`);
        } catch (err) {
          this.logger.error(`[pauseSubscription] Failed to clear cancel_at_period_end: ${err.message}`, err.stack);
        }
      }
    }

    // Pause payment collection in Stripe if we have a Stripe subscription ID
    if (workspace.subscription.stripeSubscriptionId) {
      try {
        const stripe = getStripeClient();
        await stripe.subscriptions.update(workspace.subscription.stripeSubscriptionId, {
          pause_collection: {
            behavior: 'void', // Void invoices during pause - don't collect payment
          },
        });
        this.logger.log(`Paused payment collection in Stripe for subscription ${workspace.subscription.stripeSubscriptionId}`);
      } catch (err) {
        this.logger.error(`Failed to pause Stripe subscription ${workspace.subscription.stripeSubscriptionId}: ${err.message}`, err.stack);
        // Continue with local pause even if Stripe call fails
      }
    }

    // Update subscription status to PAUSED with pause timestamp
    // Also clear cancelAt if it was set (transitioning from CANCEL_AT_PERIOD_END)
    const subscription = await this.prisma.subscription.update({
      where: { id: workspace.subscription.id },
      data: {
        status: SubscriptionStatus.PAUSED,
        pausedAt: new Date(),
        pauseReason: reason || null,
        cancelAt: null, // Clear cancel flag when pausing
      },
    });

    this.logger.log(
      `[pauseSubscription] Paused workspace ${workspaceId}${reason ? `: ${reason}` : ''}. ` +
      `Pause started at ${subscription.pausedAt?.toISOString()}`
    );

    // Track analytics
    this.analytics.trackSubscriptionPaused(workspaceId, reason);

    // Send notifications to workspace owner
    const owner = await this.prisma.workspaceMember.findFirst({
      where: { workspaceId, role: 'OWNER' },
      include: { user: true },
    });
    if (owner) {
      await this.notificationService.notifySubscriptionPaused(
        owner.userId,
        workspaceId,
        workspace.name,
      );
    }

    return {
      subscription,
      message: 'Subscription paused. All operations frozen until resumed. SLA timers and day credit burn stopped. Payment collection paused in Stripe.',
    };
  }

  /**
   * Resume subscription
   * RULE: restore from PAUSED to ACTIVE
   * - Calculate paused duration and add to totalPausedSeconds
   * - Clear pausedAt to indicate resumed state
   * - Resume payment collection in Stripe
   */
  async resumeSubscription(workspaceId: string, note?: string) {
    const workspace = await this.workspaceService.getWorkspaceWithContext(workspaceId);

    if (!workspace.subscription) {
      throw new NotFoundException(`No subscription found for workspace ${workspaceId}`);
    }

    if (workspace.subscription.status !== SubscriptionStatus.PAUSED) {
      throw new NotFoundException(`Subscription is not paused (current: ${workspace.subscription.status})`);
    }

    // Resume payment collection in Stripe if we have a Stripe subscription ID
    if (workspace.subscription.stripeSubscriptionId) {
      try {
        const stripe = getStripeClient();
        await stripe.subscriptions.update(workspace.subscription.stripeSubscriptionId, {
          pause_collection: '', // Unset pause_collection to resume
        });
        this.logger.log(`Resumed payment collection in Stripe for subscription ${workspace.subscription.stripeSubscriptionId}`);
      } catch (err) {
        this.logger.error(`Failed to resume Stripe subscription ${workspace.subscription.stripeSubscriptionId}: ${err.message}`, err.stack);
        // Continue with local resume even if Stripe call fails
      }
    }

    // Calculate the pause duration
    const pausedAt = workspace.subscription.pausedAt;
    let pauseDurationSeconds = 0;
    if (pausedAt) {
      pauseDurationSeconds = Math.floor((Date.now() - pausedAt.getTime()) / 1000);
    }

    // Update subscription: set ACTIVE, clear pausedAt, add to totalPausedSeconds
    const subscription = await this.prisma.subscription.update({
      where: { id: workspace.subscription.id },
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
      `Resumed workspace ${workspaceId}${note ? `: ${note}` : ''}. ` +
      `Was paused for ${pauseDurationSeconds} seconds. ` +
      `Total paused time: ${subscription.totalPausedSeconds} seconds`
    );

    // Track analytics
    this.analytics.trackSubscriptionResumed(workspaceId);

    // Send notifications to workspace owner
    const owner = await this.prisma.workspaceMember.findFirst({
      where: { workspaceId, role: 'OWNER' },
      include: { user: true },
    });
    if (owner) {
      await this.notificationService.notifySubscriptionResumed(
        owner.userId,
        workspaceId,
        workspace.name,
      );
    }

    return {
      subscription,
      message: `Subscription resumed. Operations allowed again. Payment collection resumed in Stripe. (Paused for ${Math.round(pauseDurationSeconds / 60)} minutes)`,
      pauseDurationSeconds,
    };
  }

  /**
   * Cancel subscription
   * RULE: stress test 4 - cancel: finish current tasks, no new auto-start
   * - New tasks cannot be created (enforced in TaskService)
   * - Do NOT auto-promote QUEUED tasks (enforced in TaskService.autoStartNextQueuedTask)
   * - Current IN_PROGRESS tasks can still move:
   *   - admin: IN_PROGRESS -> IN_REVIEW
   *   - client: IN_REVIEW -> COMPLETED
   * - After billing end date, workspace becomes read_only (future)
   */
  async cancelSubscription(workspaceId: string, reason?: string) {
    const workspace = await this.workspaceService.getWorkspaceWithContext(workspaceId);

    if (!workspace.subscription) {
      throw new NotFoundException(`No subscription found for workspace ${workspaceId}`);
    }

    const stripeSubscriptionId = workspace.subscription.stripeSubscriptionId;

    // In Stripe: set cancel_at_period_end so the customer keeps access until the end
    // of the current billing period, and won't be charged again.
    if (stripeSubscriptionId) {
      try {
        const stripe = getStripeClient();
        await stripe.subscriptions.update(stripeSubscriptionId, {
          cancel_at_period_end: true,
        });
        this.logger.log(`Set cancel_at_period_end=true in Stripe for subscription ${stripeSubscriptionId}`);
      } catch (err) {
        this.logger.error(
          `Failed to mark Stripe subscription ${stripeSubscriptionId} as cancel_at_period_end: ${err.message}`,
          err.stack,
        );
        // Continue updating local state even if Stripe call fails – but log clearly.
      }
    }

    // Locally: mark as CANCEL_AT_PERIOD_END and record when cancellation was requested.
    const subscription = await this.prisma.subscription.update({
      where: { id: workspace.subscription.id },
      data: {
        status: SubscriptionStatus.CANCEL_AT_PERIOD_END,
        cancelAt: new Date(),
      },
    });

    // Count tasks that are still in progress
    const inProgressCount = await this.prisma.task.count({
      where: {
        workspaceId,
        status: TaskStatus.IN_PROGRESS,
      },
    });

    const inReviewCount = await this.prisma.task.count({
      where: {
        workspaceId,
        status: TaskStatus.IN_REVIEW,
      },
    });

    this.logger.log(
      `Canceled workspace ${workspaceId}. ` +
      `${inProgressCount} tasks in progress, ${inReviewCount} in review.` +
      `${reason ? ` Reason: ${reason}` : ''}`,
    );

    // Track analytics
    this.analytics.trackSubscriptionCanceled(workspaceId, reason);

    // Send notifications to workspace owner
    const owner = await this.prisma.workspaceMember.findFirst({
      where: { workspaceId, role: 'OWNER' },
      include: { user: true },
    });
    if (owner) {
      await this.notificationService.notifySubscriptionCanceled(
        owner.userId,
        workspaceId,
        workspace.name,
      );
    }

    return {
      subscription,
      message: `Subscription canceled. ${inProgressCount + inReviewCount} tasks can still be completed. No new tasks will auto-start.`,
      tasksToComplete: {
        inProgress: inProgressCount,
        inReview: inReviewCount,
      },
    };
  }

  /**
   * Un-cancel subscription (clear cancel_at_period_end)
   * RULE: allow customer to resume automatic renewals before period ends.
   * - Sets Stripe cancel_at_period_end=false
   * - Restores local status to ACTIVE
   */
  async uncancelSubscription(workspaceId: string, note?: string) {
    const workspace = await this.workspaceService.getWorkspaceWithContext(workspaceId);

    if (!workspace.subscription) {
      throw new NotFoundException(`No subscription found for workspace ${workspaceId}`);
    }

    const stripeSubscriptionId = workspace.subscription.stripeSubscriptionId;

    if (stripeSubscriptionId) {
      try {
        const stripe = getStripeClient();
        await stripe.subscriptions.update(stripeSubscriptionId, {
          cancel_at_period_end: false,
        });
        this.logger.log(`Cleared cancel_at_period_end in Stripe for subscription ${stripeSubscriptionId}`);
      } catch (err) {
        this.logger.error(
          `Failed to clear cancel_at_period_end for Stripe subscription ${stripeSubscriptionId}: ${err.message}`,
          err.stack,
        );
        // Continue updating local state even if Stripe call fails – but log for follow-up.
      }
    }

    const subscription = await this.prisma.subscription.update({
      where: { id: workspace.subscription.id },
      data: {
        status: SubscriptionStatus.ACTIVE,
        cancelAt: null,
      },
    });

    this.logger.log(
      `Uncanceled subscription for workspace ${workspaceId}. Status restored to ACTIVE.${note ? ` Note: ${note}` : ''}`,
    );

    // Reuse "resumed" analytics as this is effectively resuming automatic renewals.
    this.analytics.trackSubscriptionResumed(workspaceId);

    return {
      subscription,
      message: 'Subscription cancellation undone. Automatic renewals will continue at the end of the current period.',
    };
  }

  /**
   * Upgrade subscription
   * Simplified MVP: returns a checkout URL to process the change.
   */
  async upgradeSubscription(workspaceId: string, targetPlanCode: string, mode?: string) {
    const workspace = await this.workspaceService.getWorkspaceWithContext(workspaceId);
    
    // In a real implementation, this would call Stripe to create a session for the new price
    // based on targetPlanCode + mode.
    // For V1 MVP, we will reuse the generic portal session or a "talk to sales" fallback if complex.
    
    // Mocking the intent: identifying the plan price ID would be needed here.
    // We'll assume the frontend handles the specific priceId in a direct /checkout call usually,
    // but for an "Upgrade" specific action, we might want to log it or do pre-checks.
    
    this.logger.log(`Upgrade requested for workspace ${workspaceId} to ${targetPlanCode} (${mode || 'default'})`);

    // Since we have a direct "createCheckoutSession" elsewhere (StripeController), 
    // we can just return a success/instruction here or delegate.
    // But to fulfill the "Upgrade Flow" requirement, let's return a simulated URL or instruction.
    
    // If Enterprise, we gate it.
    if (targetPlanCode === 'ENTERPRISE') {
       return { url: 'mailto:sales@sako.design?subject=Upgrade%20to%20Enterprise' };
    }

    // For others, we guide them to the billing portal if they already have a sub, 
    // or tell them to use the main subscribe buttons if they are canceled.
    if (workspace.subscription?.stripeSubscriptionId) {
        // Use portal for upgrades if supported, or just return a flag
        return { message: 'Please use the billing portal to change plans.', action: 'PORTAL' };
    }

    return { message: 'Initiate checkout for new plan.', action: 'CHECKOUT' };
  }
}

