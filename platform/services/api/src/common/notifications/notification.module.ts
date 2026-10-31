import { Global, Module } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { SlackModule } from '../../slack/slack.module';
import { MailModule } from '../mail/mail.module';

@Global()
@Module({
  imports: [PrismaModule, SlackModule, MailModule],
  controllers: [NotificationController],
  providers: [NotificationService],
  exports: [NotificationService],
})
export class NotificationModule {}

