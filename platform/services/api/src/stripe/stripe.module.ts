import { Module, forwardRef } from '@nestjs/common';
import { StripeController } from './stripe.controller';
import { StripeEventsService } from './stripe-events.service';
import { PrismaModule } from '../prisma/prisma.module';
import { DayCreditBurnService } from '../credits/day-credit-burn.service';
import { MarketingModule } from '../marketing/marketing.module';

@Module({
  imports: [PrismaModule, forwardRef(() => MarketingModule)],
  controllers: [StripeController],
  providers: [StripeEventsService, DayCreditBurnService],
  exports: [StripeEventsService],
})
export class StripeModule {}

