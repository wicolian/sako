/**
 * Queue Configuration
 *
 * Redis connection settings for BullMQ queues.
 */

import { ConfigService } from '@nestjs/config';

export const QUEUE_TRANSACTIONAL = 'email-transactional';
export const QUEUE_MARKETING = 'email-marketing';

export interface QueueConfig {
  host: string;
  port: number;
  password?: string;
  tls?: boolean;
}

export function getQueueConfig(configService: ConfigService): QueueConfig {
  const redisUrl = configService.get<string>('REDIS_URL') || 'redis://localhost:6379';

  try {
    const url = new URL(redisUrl);
    return {
      host: url.hostname,
      port: parseInt(url.port, 10) || 6379,
      password: url.password || undefined,
      tls: url.protocol === 'rediss:',
    };
  } catch {
    // Fallback for simple host:port format
    return {
      host: 'localhost',
      port: 6379,
    };
  }
}

export function getRedisConnection(configService: ConfigService) {
  const config = getQueueConfig(configService);

  return {
    host: config.host,
    port: config.port,
    password: config.password,
    ...(config.tls && { tls: {} }),
    maxRetriesPerRequest: null, // Required for BullMQ
  };
}
