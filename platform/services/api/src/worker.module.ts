/**
 * Worker Module
 *
 * Module used by the worker process.
 * Contains queue processors and schedulers.
 */

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma/prisma.module';
import { MailModule } from './common/mail/mail.module';
import { QueueModule } from './queue/queue.module';
import { QueueProcessor } from './queue/queue.processor';
import { MarketingService } from './marketing/marketing.service';
import { MarketingEmailService } from './marketing/marketing-email.service';
import { MarketingOfferService } from './marketing/marketing-offer.service';
import { MarketingScheduler } from './marketing/marketing.scheduler';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    MailModule,
    QueueModule,
  ],
  providers: [
    // Queue processor (processes email jobs)
    QueueProcessor,
    // Marketing services (needed by processor and scheduler)
    MarketingService,
    MarketingEmailService,
    MarketingOfferService,
    // Marketing scheduler (runs cron jobs)
    MarketingScheduler,
  ],
})
export class WorkerModule {}
