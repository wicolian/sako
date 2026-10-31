/**
 * Queue Service
 *
 * Provides methods to enqueue email jobs.
 * Used by API service to enqueue jobs (does not process them).
 */

import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { QUEUE_TRANSACTIONAL, QUEUE_MARKETING, getRedisConnection } from './queue.config';

export interface TransactionalEmailJob {
  type: 'welcome' | 'payment_failed' | 'task_status' | 'invite' | 'subscription_paused' | 'subscription_resumed';
  to: string;
  data: Record<string, any>;
}

export interface MarketingEmailJob {
  leadId: string;
  step: 'D0' | 'D1' | 'D3' | 'D5' | 'D10';
  email: string;
  name?: string;
}

@Injectable()
export class QueueService implements OnModuleDestroy {
  private readonly logger = new Logger(QueueService.name);
  private transactionalQueue: Queue | null = null;
  private marketingQueue: Queue | null = null;
  private readonly enabled: boolean;

  constructor(private configService: ConfigService) {
    const redisUrl = this.configService.get<string>('REDIS_URL');
    this.enabled = !!redisUrl;

    if (!this.enabled) {
      this.logger.warn('REDIS_URL not configured - Queue service disabled, emails will be sent directly');
      return;
    }

    try {
      const connection = getRedisConnection(this.configService);

      this.transactionalQueue = new Queue(QUEUE_TRANSACTIONAL, {
        connection,
        defaultJobOptions: {
          attempts: 5,
          backoff: { type: 'exponential', delay: 30000 }, // 30s initial, exponential
          removeOnComplete: { count: 1000 }, // Keep last 1000 completed jobs
          removeOnFail: { count: 5000 }, // Keep last 5000 failed jobs
        },
      });

      this.marketingQueue = new Queue(QUEUE_MARKETING, {
        connection,
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 120000 }, // 2min initial
          removeOnComplete: { count: 1000 },
          removeOnFail: { count: 5000 },
        },
      });

      this.logger.log('Queue service initialized');
    } catch (error) {
      this.logger.error('Failed to initialize queue service:', error);
      this.enabled = false;
    }
  }

  async onModuleDestroy() {
    await this.transactionalQueue?.close();
    await this.marketingQueue?.close();
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Enqueue a transactional email (high priority)
   */
  async enqueueTransactionalEmail(job: TransactionalEmailJob): Promise<string | null> {
    if (!this.transactionalQueue) {
      this.logger.debug('Queue not available, skipping enqueue');
      return null;
    }

    try {
      const result = await this.transactionalQueue.add(job.type, job, {
        priority: 1, // High priority
      });
      this.logger.debug(`Enqueued transactional email: ${job.type} to ${job.to}`);
      return result.id || null;
    } catch (error) {
      this.logger.error(`Failed to enqueue transactional email: ${error.message}`);
      return null;
    }
  }

  /**
   * Enqueue a marketing email (low priority)
   */
  async enqueueMarketingEmail(job: MarketingEmailJob): Promise<string | null> {
    if (!this.marketingQueue) {
      this.logger.debug('Queue not available, skipping enqueue');
      return null;
    }

    try {
      const result = await this.marketingQueue.add(job.step, job, {
        priority: 10, // Lower priority than transactional
        jobId: `${job.leadId}-${job.step}`, // Prevent duplicates
      });
      this.logger.debug(`Enqueued marketing email: ${job.step} to ${job.email}`);
      return result.id || null;
    } catch (error) {
      this.logger.error(`Failed to enqueue marketing email: ${error.message}`);
      return null;
    }
  }
}
