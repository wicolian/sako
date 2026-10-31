import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { WorkspaceModule } from '../workspace/workspace.module';
import { BillingModule } from '../billing/billing.module';

import { ComposerGatewayController } from './composer-gateway.controller';
import { ComposerService } from './composer.service';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    WorkspaceModule,
    BillingModule,
  ],
  controllers: [ComposerGatewayController],
  providers: [ComposerService],
  exports: [ComposerService],
})
export class ComposerModule {}

