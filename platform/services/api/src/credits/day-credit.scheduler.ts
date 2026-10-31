/**
 * Day Credit Scheduler
 * Runs daily cron job to burn day credits for active subscriptions
 */

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DayCreditBurnService } from './day-credit-burn.service';
import * as Sentry from '@sentry/nestjs';

@Injectable()
export class DayCreditScheduler {
  private readonly logger = new Logger(DayCreditScheduler.name);

  constructor(private readonly dayCreditBurnService: DayCreditBurnService) {}

  /**
   * Daily credit burn job
   * Runs at 2:00 AM UTC every day
   * 
   * To change the schedule:
   * - CronExpression.EVERY_DAY_AT_MIDNIGHT = '0 0 * * *' (midnight UTC)
   * - CronExpression.EVERY_DAY_AT_2AM = '0 2 * * *' (2 AM UTC)
   * - '0 5 * * *' = 5 AM UTC
   * 
   * Format: '* * * * * *' = second minute hour day month dayOfWeek
   */
  @Cron('0 2 * * *', {
    name: 'day-credit-burn',
    timeZone: 'UTC',
  })
  async handleDailyBurn() {
    this.logger.log('🕐 Daily credit burn job triggered (2:00 AM UTC)');

    try {
      const stats = await this.dayCreditBurnService.burnForAllActiveSubscriptions();

      this.logger.log(
        `✅ Daily credit burn job completed: ${stats.burned} burned, ${stats.skipped} skipped, ${stats.errors} errors`,
      );

      // Send warning to Sentry if there were errors during credit burn
      if (stats.errors > 0) {
        this.logger.error(`⚠️ ${stats.errors} errors occurred during credit burn!`);
        Sentry.captureMessage(`Day credit burn completed with ${stats.errors} errors`, {
          level: 'warning',
          tags: { job: 'day-credit-burn' },
          extra: {
            burned: stats.burned,
            skipped: stats.skipped,
            errors: stats.errors,
          },
        });
      }
    } catch (error) {
      this.logger.error(`❌ Daily credit burn job failed: ${error.message}`, error.stack);
      // Send critical failure alert to Sentry
      Sentry.captureException(error, {
        tags: {
          job: 'day-credit-burn',
          jobType: 'critical-failure',
        },
        extra: {
          jobName: 'day-credit-burn',
          schedule: '0 2 * * *',
          timezone: 'UTC',
        },
      });
    }
  }

}

