import { Module } from '@nestjs/common';
import { TaskController } from './task.controller';
import { TaskAttachmentController } from './task-attachment.controller';
import { TaskService } from './task.service';
import { TaskEstimatorService } from './task-estimator.service';
import { SlaMonitorService } from './sla-monitor.service';
import { WorkspaceModule } from '../workspace/workspace.module';
import { AdminTaskController } from './admin-task.controller';
import { AiModule } from '../ai/ai.module';
import { StorageModule } from '../common/storage/storage.module';
import { TaskGateway } from './task.gateway';
import { JwtModule } from '@nestjs/jwt';
import { SlackModule } from '../slack/slack.module';
import { DayCreditBurnService } from '../credits/day-credit-burn.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [WorkspaceModule, AiModule, StorageModule, JwtModule, SlackModule, PrismaModule],
  controllers: [TaskController, AdminTaskController, TaskAttachmentController],
  providers: [TaskService, TaskEstimatorService, TaskGateway, DayCreditBurnService, SlaMonitorService],
  exports: [TaskService, TaskEstimatorService, TaskGateway, SlaMonitorService],
})
export class TaskModule {}
