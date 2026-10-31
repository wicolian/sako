/**
 * SLA Monitor Service
 *
 * Runs hourly cron job to:
 * 1. Check for tasks approaching their SLA deadline (< 6 hours remaining)
 * 2. Send warning notifications to clients and admins
 * 3. Mark tasks as escalated when they go past deadline
 */

import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../common/notifications/notification.service';
import { computeSlaFields } from '../common/utils/sla.util';
import { TaskStatus } from '@prisma/client';
import * as Sentry from '@sentry/nestjs';

// Threshold for SLA warning notification (6 hours in seconds)
const SLA_WARNING_THRESHOLD_SECONDS = 6 * 60 * 60;

@Injectable()
export class SlaMonitorService {
  private readonly logger = new Logger(SlaMonitorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
  ) {}

  /**
   * Hourly SLA check job
   * Runs every hour to check for approaching deadlines
   */
  @Cron('0 * * * *', {
    name: 'sla-monitor',
    timeZone: 'UTC',
  })
  async handleHourlySlaCheck() {
    this.logger.log('🔍 Hourly SLA monitor check triggered');

    try {
      const stats = await this.checkApproachingDeadlines();

      this.logger.log(
        `✅ SLA monitor check completed: ${stats.checked} checked, ${stats.warned} warned, ${stats.escalated} escalated`,
      );

      if (stats.warned > 0 || stats.escalated > 0) {
        Sentry.addBreadcrumb({
          category: 'sla-monitor',
          message: `SLA check: ${stats.warned} warnings, ${stats.escalated} escalations`,
          level: 'info',
        });
      }
    } catch (error) {
      this.logger.error(`❌ SLA monitor check failed: ${error.message}`, error.stack);
      Sentry.captureException(error, {
        tags: { job: 'sla-monitor' },
      });
    }
  }

  /**
   * Check all IN_PROGRESS tasks for approaching deadlines
   */
  async checkApproachingDeadlines(): Promise<{
    checked: number;
    warned: number;
    escalated: number;
  }> {
    const stats = { checked: 0, warned: 0, escalated: 0 };
    const now = new Date();

    // Get all tasks that are IN_PROGRESS
    const tasks = await this.prisma.task.findMany({
      where: {
        status: TaskStatus.IN_PROGRESS,
        inProgressAt: { not: null },
      },
      include: {
        workspace: {
          include: {
            subscription: true,
          },
        },
      },
    });

    this.logger.debug(`Checking ${tasks.length} IN_PROGRESS tasks for SLA status`);

    for (const task of tasks) {
      stats.checked++;

      try {
        // Compute SLA fields
        const subscriptionPause = task.workspace?.subscription?.pausedAt
          ? {
              pausedAt: task.workspace.subscription.pausedAt,
              totalPausedSeconds: task.workspace.subscription.totalPausedSeconds ?? 0,
            }
          : undefined;

        const slaFields = computeSlaFields(task, now, subscriptionPause);

        // Skip if already late - handled by escalation
        if (slaFields.slaIsLate) {
          // Check if needs escalation
          if (!task.isEscalated) {
            await this.escalateTask(task, slaFields.slaRemainingSeconds ?? 0);
            stats.escalated++;
          }
          continue;
        }

        // Check if approaching deadline and not already warned
        const remainingSeconds = slaFields.slaRemainingSeconds ?? 0;
        if (remainingSeconds <= SLA_WARNING_THRESHOLD_SECONDS && !task.slaWarningNotifiedAt) {
          await this.prisma.task.update({
            where: { id: task.id },
            data: { slaWarningNotifiedAt: new Date() },
          });

          const hoursRemaining = Math.floor(remainingSeconds / 3600);
          await this.notificationService.notifySlaWarning(
            task.createdById!,
            task.workspaceId,
            task.id,
            task.title,
            hoursRemaining,
          );
          stats.warned++;
        }
      } catch (error) {
        this.logger.error(`Error checking task ${task.id}: ${error.message}`);
      }
    }

    return stats;
  }

  /**
   * Escalate a task that has gone past its SLA deadline
   */
  private async escalateTask(
    task: { id: string; workspaceId: string; title: string; createdById: string | null },
    remainingSeconds: number,
  ): Promise<void> {
    const hoursOver = Math.abs(Math.floor(remainingSeconds / 3600));

    // Mark as escalated
    await this.prisma.task.update({
      where: { id: task.id },
      data: {
        isEscalated: true,
        escalatedAt: new Date(),
      },
    });

    // Notify task creator and workspace owners about late completion
    if (task.createdById) {
      await this.notificationService.notifySlaMissed(
        task.createdById,
        task.workspaceId,
        task.id,
        task.title,
        hoursOver,
      );
    }

    this.logger.warn(`🚨 Task escalated: "${task.title}" (${hoursOver}h over SLA)`);
  }

  /**
   * Get all studio admin user IDs
   */
  private async getStudioAdminIds(): Promise<string[]> {
    const admins = await this.prisma.user.findMany({
      where: { role: 'ADMIN' },
      select: { id: true },
    });
    return admins.map((a) => a.id);
  }
}

