/**
 * Queue Module
 *
 * Provides email queue infrastructure using BullMQ.
 * - QueueService: For enqueuing jobs (used by API)
 * - QueueProcessor: For processing jobs (used by Worker)
 */

import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { QueueService } from './queue.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [QueueService],
  exports: [QueueService],
})
export class QueueModule {}
