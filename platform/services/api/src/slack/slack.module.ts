import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SlackController } from './slack.controller';
import { SlackService } from './slack.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  // SlackService only depends on ConfigService and PrismaService; no need to import WorkspaceModule
  imports: [ConfigModule, PrismaModule],
  controllers: [SlackController],
  providers: [SlackService],
  exports: [SlackService],
})
export class SlackModule {}

