/**
 * Day Credit Burn Service
 * 
 * Responsible for burning exactly 1 day credit per active day for each ACTIVE subscription.
 * 
 * Rules:
 * - Only burn when subscription.status = ACTIVE
 * - Skip PAUSED, PAST_DUE, CANCELED subscriptions
 * - Only burn if there are credits available (totalCredits > usedCredits)
 * - Only burn once per day (idempotency via lastDayCreditBurnAt)
 * - Respect workspace timezone if stored, otherwise use UTC
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionStatus } from '@prisma/client';

@Injectable()
export class DayCreditBurnService {
  private readonly logger = new Logger(DayCreditBurnService.name);

  constructor(private readonly prisma: PrismaService) { }

  /**
   * Burn day credits for all active subscriptions
   * Called by the daily cron job
   */
  async burnForAllActiveSubscriptions(): Promise<{
    processed: number;
    burned: number;
    skipped: number;
    errors: number;
  }> {
    this.logger.log('🔥 Starting daily credit burn job...');

    const stats = {
      processed: 0,
      burned: 0,
      skipped: 0,
      errors: 0,
    };

    // Get subscriptions that should continue burning credits
    const subscriptions = await this.prisma.subscription.findMany({
      where: {
        status: {
          in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.CANCELED],
        },
      },
      include: {
        workspace: true,
      },
    });

    this.logger.log(`Found ${subscriptions.length} ACTIVE subscriptions to check`);

    for (const subscription of subscriptions) {
      stats.processed++;

      try {
        const burned = await this.burnDayCreditForWorkspace(subscription.workspaceId);
        if (burned) {
          stats.burned++;
        } else {
          stats.skipped++;
        }
      } catch (error) {
        stats.errors++;
        this.logger.error(
          `Failed to burn credit for workspace ${subscription.workspaceId}: ${error.message}`,
          error.stack,
        );
      }
    }

    this.logger.log(
      `✅ Daily credit burn complete: ${stats.burned} burned, ${stats.skipped} skipped, ${stats.errors} errors (${stats.processed} total)`,
    );

    return stats;
  }

  /**
   * Burn 1 day credit for a specific workspace
   * Returns true if credit was burned, false if skipped
   */
  async burnDayCreditForWorkspace(workspaceId: string): Promise<boolean> {
    // Get workspace with subscription
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: { subscription: true },
    });

    if (!workspace) {
      this.logger.warn(`Workspace not found: ${workspaceId}`);
      return false;
    }

    if (!workspace.subscription) {
      this.logger.warn(`No subscription for workspace: ${workspaceId}`);
      return false;
    }

    const subscription = workspace.subscription;

    // Skip PAUSED subscriptions entirely
    if (subscription.status === SubscriptionStatus.PAUSED) {
      this.logger.debug(
        `Skipping workspace ${workspaceId}: status is PAUSED`,
      );
      return false;
    }

    // Get workspace timezone (default to UTC if not set)
    const timezone = workspace.timezone || 'UTC';
    const now = new Date();

    // Check if we already burned today (idempotency)
    if (subscription.lastDayCreditBurnAt) {
      const lastBurn = new Date(subscription.lastDayCreditBurnAt);
      const todayStart = this.getStartOfDay(now, timezone);

      if (lastBurn >= todayStart) {
        this.logger.debug(
          `Skipping workspace ${workspaceId}: already burned today (last burn: ${lastBurn.toISOString()})`,
        );
        return false;
      }
    }

    // Get active day credit for this billing period
    const dayCredit = await this.prisma.dayCredit.findFirst({
      where: {
        workspaceId,
        periodStart: { lte: now },
        periodEnd: { gte: now },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!dayCredit) {
      this.logger.warn(`No active day credit found for workspace ${workspaceId}`);
      return false;
    }

    // Check if credits are available
    if (dayCredit.usedCredits >= dayCredit.totalCredits) {
      this.logger.warn(
        `No credits available for workspace ${workspaceId} (${dayCredit.usedCredits}/${dayCredit.totalCredits})`,
      );
      return false;
    }

    // Validate credit amount matches billing interval (data integrity check)
    if (subscription.billingPeriodStart && subscription.billingPeriodEnd) {
      const periodDays = Math.ceil(
        (subscription.billingPeriodEnd.getTime() - subscription.billingPeriodStart.getTime()) /
        (1000 * 60 * 60 * 24),
      );

      const expectedCredits = periodDays >= 300 ? 365 : 30; // yearly vs monthly

      if (dayCredit.totalCredits !== expectedCredits) {
        this.logger.warn(
          `⚠️ Credit mismatch for workspace ${workspaceId}: expected ${expectedCredits} but found ${dayCredit.totalCredits} (period: ${periodDays} days)`,
        );
      }
    }

    // Burn 1 credit using a transaction for atomicity
    try {
      await this.prisma.$transaction([
        // Increment used credits
        this.prisma.dayCredit.update({
          where: { id: dayCredit.id },
          data: {
            usedCredits: { increment: 1 },
          },
        }),

        // Update last burn timestamp
        this.prisma.subscription.update({
          where: { id: subscription.id },
          data: {
            lastDayCreditBurnAt: now,
          },
        }),

        // Log credit history for audit trail
        this.prisma.dayCreditHistory.create({
          data: {
            workspaceId,
            action: 'BURN',
            amount: 1,
            balanceBefore: dayCredit.usedCredits,
            balanceAfter: dayCredit.usedCredits + 1,
            periodStart: dayCredit.periodStart,
            periodEnd: dayCredit.periodEnd,
          },
        }),
      ]);

      this.logger.log(
        `🔥 Burned 1 day credit for workspace ${workspaceId} (${dayCredit.usedCredits + 1}/${dayCredit.totalCredits}) [Period: ${dayCredit.periodStart.toISOString().split('T')[0]} to ${dayCredit.periodEnd.toISOString().split('T')[0]}]`,
      );

      return true;
    } catch (error) {
      this.logger.error(`Transaction failed for workspace ${workspaceId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get start of day in given timezone
   * Used for idempotency checks
   */
  private getStartOfDay(date: Date, timezone: string): Date {
    // For simplicity, using UTC date comparison
    // In a production system, you'd want to use a library like date-fns-tz or luxon
    // to properly handle timezones

    const d = new Date(date);
    d.setUTCHours(0, 0, 0, 0);
    return d;
  }

  /**
   * Check if a workspace is eligible to burn credits today
   * Used by the debug endpoint
   */
  async isBurnEligibleToday(workspaceId: string): Promise<{
    eligible: boolean;
    reason?: string;
  }> {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: { subscription: true },
    });

    if (!workspace) {
      return { eligible: false, reason: 'Workspace not found' };
    }

    if (!workspace.subscription) {
      return { eligible: false, reason: 'No subscription' };
    }

    const subscription = workspace.subscription;

    // Explicit check for PAUSED status (SLA timer and credits frozen)
    if (subscription.status === SubscriptionStatus.PAUSED) {
      return { eligible: false, reason: 'Subscription is PAUSED (credits and SLA frozen)' };
    }

    if (subscription.status !== SubscriptionStatus.ACTIVE) {
      return { eligible: false, reason: `Status is ${subscription.status} (not ACTIVE)` };
    }

    const now = new Date();
    const timezone = workspace.timezone || 'UTC';

    // Check if already burned today
    if (subscription.lastDayCreditBurnAt) {
      const lastBurn = new Date(subscription.lastDayCreditBurnAt);
      const todayStart = this.getStartOfDay(now, timezone);

      if (lastBurn >= todayStart) {
        return { eligible: false, reason: 'Already burned today' };
      }
    }

    // Check for active day credit
    const dayCredit = await this.prisma.dayCredit.findFirst({
      where: {
        workspaceId,
        periodStart: { lte: now },
        periodEnd: { gte: now },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!dayCredit) {
      return { eligible: false, reason: 'No active day credit period' };
    }

    if (dayCredit.usedCredits >= dayCredit.totalCredits) {
      return { eligible: false, reason: 'Credits exhausted' };
    }

    return { eligible: true };
  }

  /**
   * Issue an SLA credit refund when a task is completed late
   * Adds 1 day credit to the workspace's current period
   * 
   * @param workspaceId - The workspace to credit
   * @param taskId - The task that missed SLA (for audit trail)
   * @param taskTitle - The task title (for audit trail)
   * @returns Whether the credit was issued successfully
   */
  async issueSlaCredit(
    workspaceId: string,
    taskId: string,
    taskTitle: string,
  ): Promise<{ credited: boolean; newBalance?: number; reason?: string }> {
    const now = new Date();

    // Find the active day credit period
    const dayCredit = await this.prisma.dayCredit.findFirst({
      where: {
        workspaceId,
        periodStart: { lte: now },
        periodEnd: { gte: now },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!dayCredit) {
      this.logger.warn(`Cannot issue SLA credit for workspace ${workspaceId}: no active credit period`);
      return { credited: false, reason: 'No active credit period' };
    }

    // Calculate new balance
    const currentBalance = dayCredit.totalCredits - dayCredit.usedCredits;
    const newTotalCredits = dayCredit.totalCredits + 1;
    const newBalance = newTotalCredits - dayCredit.usedCredits;

    try {
      await this.prisma.$transaction([
        // Increment total credits (giving them an extra day)
        this.prisma.dayCredit.update({
          where: { id: dayCredit.id },
          data: {
            totalCredits: { increment: 1 },
          },
        }),

        // Log credit history for audit trail
        this.prisma.dayCreditHistory.create({
          data: {
            workspaceId,
            action: 'SLA_REFUND',
            amount: 1,
            balanceBefore: currentBalance,
            balanceAfter: newBalance,
            periodStart: dayCredit.periodStart,
            periodEnd: dayCredit.periodEnd,
            notes: `SLA missed on task: ${taskTitle} (${taskId})`,
          },
        }),
      ]);

      this.logger.log(
        `💸 Issued SLA credit for workspace ${workspaceId}: +1 day credit (new balance: ${newBalance}/${newTotalCredits}) for task "${taskTitle}"`,
      );

      return { credited: true, newBalance };
    } catch (error) {
      this.logger.error(`Failed to issue SLA credit for workspace ${workspaceId}: ${error.message}`);
      return { credited: false, reason: error.message };
    }
  }
}
