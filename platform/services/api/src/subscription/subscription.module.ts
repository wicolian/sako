import { Module } from '@nestjs/common';
import { SubscriptionController } from './subscription.controller';
import { SubscriptionService } from './subscription.service';
import { WorkspaceModule } from '../workspace/workspace.module';
import { AnalyticsModule } from '../common/analytics/analytics.module';
import { NotificationModule } from '../common/notifications/notification.module';

@Module({
  imports: [WorkspaceModule, AnalyticsModule, NotificationModule],
  controllers: [SubscriptionController],
  providers: [SubscriptionService],
  exports: [SubscriptionService],
})
export class SubscriptionModule {}

