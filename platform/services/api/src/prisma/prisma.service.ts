import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({
      // Only log errors by default - query logging causes memory issues
      // Set DEBUG_PRISMA=true to enable query logging for debugging
      log: process.env.DEBUG_PRISMA === 'true' 
        ? ['query', 'error', 'warn'] 
        : ['error', 'warn'],
    });
  }

  async onModuleInit() {
    await this.$connect();
    console.log('✅ Prisma connected to database');
  }

  async onModuleDestroy() {
    await this.$disconnect();
    console.log('👋 Prisma disconnected from database');
  }

  async cleanDatabase() {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Cannot clean database in production');
    }
    // Helper for testing - truncate all tables
    const models = Object.keys(this).filter(
      (key) => !key.startsWith('_') && !key.startsWith('$')
    );
    return Promise.all(models.map((model) => (this as any)[model].deleteMany()));
  }
}

