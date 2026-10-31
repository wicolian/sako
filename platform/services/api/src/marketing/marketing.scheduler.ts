/**
 * Marketing Scheduler
 *
 * Runs daily to send marketing nurture emails.
 * Uses distributed lock to prevent double-sends.
 */

import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import Redis from 'ioredis';
import { MarketingService } from './marketing.service';
import { QueueService } from '../queue/queue.service';
import { MarketingEmailStep } from '@prisma/client';
import { getQueueConfig } from '../queue/queue.config';

type RedisClient = InstanceType<typeof Redis>;

@Injectable()
export class MarketingScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MarketingScheduler.name);
  private readonly enabled: boolean;
  private readonly lockKey = 'marketing:cron:daily';
  private readonly lockTtl = 300; // 5 minutes
  private redis: RedisClient | null = null;

  constructor(
    private configService: ConfigService,
    private marketingService: MarketingService,
    private queueService: QueueService,
  ) {
    this.enabled = this.configService.get<string>('MARKETING_CRON_ENABLED') === 'true';
    if (this.enabled) {
      this.logger.log('Marketing scheduler enabled');
    } else {
      this.logger.log('Marketing scheduler disabled (MARKETING_CRON_ENABLED != true)');
    }
  }

  async onModuleInit() {
    if (!this.enabled) return;

    const redisUrl = this.configService.get<string>('REDIS_URL');
    if (redisUrl) {
      try {
        const config = getQueueConfig(this.configService);
        this.redis = new Redis({
          host: config.host,
          port: config.port,
          password: config.password,
          ...(config.tls && { tls: {} }),
        });
        this.logger.log('Redis connected for distributed lock');
      } catch (error) {
        this.logger.error('Failed to connect Redis for lock:', error);
      }
    }
  }

  async onModuleDestroy() {
    await this.redis?.quit();
  }

  /**
   * Run daily at 10 AM
   */
  @Cron('0 10 * * *')
  async handleDailySequence() {
    if (!this.enabled) {
      return;
    }

    // Acquire distributed lock
    const lockAcquired = await this.acquireLock();
    if (!lockAcquired) {
      this.logger.log('Cron already running on another instance, skipping');
      return;
    }

    try {
      this.logger.log('Starting daily marketing email sequence');
      await this.processSequence();
      this.logger.log('Daily marketing email sequence completed');
    } catch (error) {
      this.logger.error('Marketing sequence failed:', error);
    } finally {
      await this.releaseLock();
    }
  }

  /**
   * Manual trigger for testing
   */
  async triggerManually() {
    if (!this.marketingService.isEnabled()) {
      return { success: false, error: 'Marketing leads not enabled' };
    }

    const lockAcquired = await this.acquireLock();
    if (!lockAcquired) {
      return { success: false, error: 'Cron already running' };
    }

    try {
      await this.processSequence();
      return { success: true };
    } finally {
      await this.releaseLock();
    }
  }

  private async processSequence() {
    const leads = await this.marketingService.getUnconvertedLeadsForSequence();
    this.logger.log(`Processing ${leads.length} unconverted leads`);

    let enqueued = 0;
    let skipped = 0;
    let errors = 0;

    for (const lead of leads) {
      try {
        const step = this.determineStep(lead);
        if (!step) {
          skipped++;
          continue;
        }

        // Check if already sent
        const alreadySent = lead.emails.some((e) => e.step === step);
        if (alreadySent) {
          skipped++;
          continue;
        }

        // Enqueue the email
        await this.queueService.enqueueMarketingEmail({
          leadId: lead.id,
          step,
          email: lead.email,
          name: lead.name || undefined,
        });

        enqueued++;
      } catch (error) {
        this.logger.error(`Failed to process lead ${lead.id}:`, error);
        errors++;
      }
    }

    this.logger.log(`Sequence complete: ${enqueued} enqueued, ${skipped} skipped, ${errors} errors`);
  }

  private determineStep(lead: { signupDate: Date; emails: { step: MarketingEmailStep }[] }): MarketingEmailStep | null {
    const daysSinceSignup = this.daysBetween(lead.signupDate, new Date());
    const sentSteps = new Set(lead.emails.map((e) => e.step));

    // Determine which step to send based on days since signup
    // D0: Day 0 (within first 12 hours or same day)
    // D1: Day 1
    // D3: Day 3
    // D5: Day 5
    // D10: Day 10

    if (daysSinceSignup === 0 && !sentSteps.has(MarketingEmailStep.D0)) {
      return MarketingEmailStep.D0;
    }
    if (daysSinceSignup >= 1 && !sentSteps.has(MarketingEmailStep.D1)) {
      return MarketingEmailStep.D1;
    }
    if (daysSinceSignup >= 3 && !sentSteps.has(MarketingEmailStep.D3)) {
      return MarketingEmailStep.D3;
    }
    if (daysSinceSignup >= 5 && !sentSteps.has(MarketingEmailStep.D5)) {
      return MarketingEmailStep.D5;
    }
    if (daysSinceSignup >= 10 && !sentSteps.has(MarketingEmailStep.D10)) {
      return MarketingEmailStep.D10;
    }

    return null; // All steps sent or not time yet
  }

  private daysBetween(start: Date, end: Date): number {
    const msPerDay = 24 * 60 * 60 * 1000;
    return Math.floor((end.getTime() - start.getTime()) / msPerDay);
  }

  private async acquireLock(): Promise<boolean> {
    if (!this.redis) {
      // No Redis = no lock = allow single instance
      this.logger.warn('No Redis for lock, proceeding without distributed lock');
      return true;
    }

    try {
      // Use SET with NX and EX options for atomic lock acquisition
      const result = await this.redis.set(this.lockKey, 'locked', 'EX', this.lockTtl, 'NX');
      return result === 'OK';
    } catch (error) {
      this.logger.error('Failed to acquire lock:', error);
      return false;
    }
  }

  private async releaseLock(): Promise<void> {
    if (!this.redis) return;

    try {
      await this.redis.del(this.lockKey);
    } catch (error) {
      this.logger.error('Failed to release lock:', error);
    }
  }
}
