/**
 * Credits Module
 * Manages day credits and AI credits, including scheduled burning
 */

import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { DayCreditBurnService } from './day-credit-burn.service';
import { DayCreditScheduler } from './day-credit.scheduler';
import { CreditsController } from './credits.controller';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [CreditsController],
  providers: [DayCreditBurnService, DayCreditScheduler, PrismaService],
  exports: [DayCreditBurnService],
})
export class CreditsModule {}

