/**
 * Marketing Module
 *
 * Provides lead capture, email nurture, and admin functionality.
 */

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from '../prisma/prisma.module';
import { MailModule } from '../common/mail/mail.module';
import { QueueModule } from '../queue/queue.module';
import { MarketingService } from './marketing.service';
import { MarketingEmailService } from './marketing-email.service';
import { MarketingOfferService } from './marketing-offer.service';
import { MarketingScheduler } from './marketing.scheduler';
import { MarketingController } from './marketing.controller';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    MailModule,
    QueueModule,
    ScheduleModule.forRoot(),
  ],
  controllers: [MarketingController],
  providers: [
    MarketingService,
    MarketingEmailService,
    MarketingOfferService,
    MarketingScheduler,
  ],
  exports: [
    MarketingService,
    MarketingEmailService,
    MarketingOfferService,
  ],
})
export class MarketingModule {}
