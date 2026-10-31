import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { WorkspaceModule } from './workspace/workspace.module';
import { BrandModule } from './brand/brand.module';
import { TaskModule } from './task/task.module';
import { SubscriptionModule } from './subscription/subscription.module';
import { StudioModule } from './studio/studio.module';
import { AuthModule } from './auth/auth.module';
import { StripeModule } from './stripe/stripe.module';
import { CreditsModule } from './credits/credits.module';
import { SlackModule } from './slack/slack.module';
import { MailModule } from './common/mail/mail.module';
import { BillingModule } from './billing/billing.module';
import { UserModule } from './user/user.module';
import { HealthModule } from './health/health.module';
import { AnalyticsModule } from './common/analytics/analytics.module';
import { SearchModule } from './search/search.module';
import { NotificationModule } from './common/notifications/notification.module';
import { ReviewModule } from './review/review.module';
import { ComposerModule } from './composer/composer.module';
import { QueueModule } from './queue/queue.module';
import { MarketingModule } from './marketing/marketing.module';
import { AppController } from './app.controller';
import { AdminUtilsController } from './admin/admin-utils.controller';
import { DevAdminUtilsController } from './admin/dev-admin-utils.controller';
import { AdminWorkspaceController } from './admin/admin-workspace.controller';
import { AdminUsersController } from './admin/admin-users.controller';
import { AdminTasksController } from './admin/admin-tasks.controller';
import { AdminMetricsController } from './admin/admin-metrics.controller';
import { AuthMiddleware } from './auth/auth.middleware';
import { ClerkAuthGuard } from './auth/clerk-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';
import { WorkspaceMemberGuard } from './common/guards/workspace-member.guard';
import { SubscriptionGuard } from './billing/guards/subscription.guard';
import { AdminGuard } from './common/guards/admin.guard';
import { ThrottlerModule } from '@nestjs/throttler';
import { SentryModule } from '@sentry/nestjs/setup';

const controllers: any[] = [AppController, AdminUtilsController, AdminWorkspaceController, AdminUsersController, AdminMetricsController, AdminTasksController];

if (process.env.ENABLE_DEV_ADMIN === 'true') {
  controllers.push(DevAdminUtilsController);
}

@Module({
  imports: [
    SentryModule.forRoot(),
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60,
        limit: 100,
      },
    ]),
    PrismaModule,
    WorkspaceModule,
    BrandModule,
    TaskModule,
    SubscriptionModule,
    StudioModule,
    AuthModule,
    StripeModule,
    CreditsModule, // Daily credit burn scheduler
    BillingModule,
    SlackModule,
    MailModule,
    UserModule,
    HealthModule,
    AnalyticsModule,
    SearchModule,
    NotificationModule,
    ReviewModule,
    ComposerModule, // Composer Gateway (partner API for external Composer app)
    QueueModule, // Email queue infrastructure (BullMQ + Redis)
    MarketingModule, // Lead capture and nurture emails
  ],
  controllers,
  providers: [
    {
      provide: APP_GUARD,
      useClass: ClerkAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_GUARD,
      useClass: WorkspaceMemberGuard,
    },
    {
      provide: APP_GUARD,
      useClass: SubscriptionGuard,
    },
    {
      provide: APP_GUARD,
      useClass: AdminGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(AuthMiddleware).forRoutes('*');
  }
}
