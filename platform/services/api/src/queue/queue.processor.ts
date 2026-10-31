/**
 * Queue Processor
 *
 * Runs in the worker process only.
 * Processes transactional and marketing email jobs.
 */

import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Worker, Job } from 'bullmq';
import { QUEUE_TRANSACTIONAL, QUEUE_MARKETING, getRedisConnection } from './queue.config';
import { MailService } from '../common/mail/mail.service';
import { MarketingEmailService } from '../marketing/marketing-email.service';
import { TransactionalEmailJob, MarketingEmailJob } from './queue.service';

@Injectable()
export class QueueProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QueueProcessor.name);
  private transactionalWorker: Worker | null = null;
  private marketingWorker: Worker | null = null;

  constructor(
    private configService: ConfigService,
    private mailService: MailService,
    private marketingEmailService: MarketingEmailService,
  ) {}

  async onModuleInit() {
    const redisUrl = this.configService.get<string>('REDIS_URL');
    if (!redisUrl) {
      this.logger.warn('REDIS_URL not configured - Queue processor disabled');
      return;
    }

    const connection = getRedisConnection(this.configService);

    // Transactional email worker (high concurrency)
    this.transactionalWorker = new Worker(
      QUEUE_TRANSACTIONAL,
      async (job: Job<TransactionalEmailJob>) => {
        await this.processTransactionalEmail(job);
      },
      {
        connection,
        concurrency: 5,
        limiter: {
          max: 10, // Max 10 jobs per second
          duration: 1000,
        },
      },
    );

    this.transactionalWorker.on('completed', (job) => {
      this.logger.debug(`Transactional email completed: ${job.id}`);
    });

    this.transactionalWorker.on('failed', (job, err) => {
      this.logger.error(`Transactional email failed: ${job?.id} - ${err.message}`);
    });

    // Marketing email worker (low concurrency)
    this.marketingWorker = new Worker(
      QUEUE_MARKETING,
      async (job: Job<MarketingEmailJob>) => {
        await this.processMarketingEmail(job);
      },
      {
        connection,
        concurrency: 2,
        limiter: {
          max: 5, // Max 5 jobs per second
          duration: 1000,
        },
      },
    );

    this.marketingWorker.on('completed', (job) => {
      this.logger.debug(`Marketing email completed: ${job.id}`);
    });

    this.marketingWorker.on('failed', (job, err) => {
      this.logger.error(`Marketing email failed: ${job?.id} - ${err.message}`);
    });

    this.logger.log('Queue processors started');
  }

  async onModuleDestroy() {
    await this.transactionalWorker?.close();
    await this.marketingWorker?.close();
    this.logger.log('Queue processors stopped');
  }

  private async processTransactionalEmail(job: Job<TransactionalEmailJob>): Promise<void> {
    const { type, to, data } = job.data;
    this.logger.log(`Processing transactional email: ${type} to ${this.maskEmail(to)}`);

    try {
      switch (type) {
        case 'welcome':
          await this.mailService.sendWelcomeEmailDirect(to, data.workspaceName);
          break;
        case 'payment_failed':
          await this.mailService.sendPaymentFailedEmailDirect(to, data.workspaceName, data.invoiceUrl);
          break;
        case 'task_status':
          await this.mailService.sendTaskStatusUpdateEmailDirect(to, data.taskTitle, data.status, data.taskId);
          break;
        case 'invite':
          await this.mailService.sendInviteEmailDirect(to, data.workspaceName, data.inviterName, data.inviteUrl);
          break;
        case 'subscription_paused':
          await this.mailService.sendSubscriptionPausedEmailDirect(to, data.workspaceName);
          break;
        case 'subscription_resumed':
          await this.mailService.sendSubscriptionResumedEmailDirect(to, data.workspaceName);
          break;
        default:
          this.logger.warn(`Unknown transactional email type: ${type}`);
      }
    } catch (error) {
      this.logger.error(`Failed to send transactional email ${type}: ${error.message}`);
      throw error; // Re-throw to trigger retry
    }
  }

  private async processMarketingEmail(job: Job<MarketingEmailJob>): Promise<void> {
    const { leadId, step, email } = job.data;
    this.logger.log(`Processing marketing email: ${step} to ${this.maskEmail(email)}`);

    try {
      await this.marketingEmailService.sendStepDirect(leadId, step);
    } catch (error) {
      this.logger.error(`Failed to send marketing email ${step}: ${error.message}`);
      throw error; // Re-throw to trigger retry
    }
  }

  private maskEmail(email: string): string {
    const [local, domain] = email.split('@');
    if (!local || !domain) return '***';
    const masked = local.length > 2 ? `${local[0]}***${local.slice(-1)}` : '***';
    return `${masked}@${domain}`;
  }
}
