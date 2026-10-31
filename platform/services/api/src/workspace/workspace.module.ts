import { Module } from '@nestjs/common';
import { WorkspaceController } from './workspace.controller';
import { WorkspaceService } from './workspace.service';
import { CreditsModule } from '../credits/credits.module';
import { NotificationModule } from '../common/notifications/notification.module';

@Module({
  imports: [CreditsModule, NotificationModule],
  controllers: [WorkspaceController],
  providers: [WorkspaceService],
  exports: [WorkspaceService],
})
export class WorkspaceModule {}
