import { Module } from '@nestjs/common';
import { CheckoutCleanupScheduler } from './checkout-cleanup.scheduler';
import { PrismaModule } from '../prisma/prisma.module';
import { SlackModule } from '../slack/slack.module';
import { ConfigModule } from '@nestjs/config';

import { BillingController } from './billing.controller';

@Module({
    imports: [PrismaModule, SlackModule, ConfigModule],
    controllers: [BillingController],
    providers: [CheckoutCleanupScheduler],
    exports: [CheckoutCleanupScheduler],
})
export class BillingModule { }
