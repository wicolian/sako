import { PrismaClient } from '@prisma/client';

/**
 * Separate Prisma client for the Composer database (READ-ONLY)
 * 
 * This connects to the composer production database to read:
 * - ModelRun (generation metrics: count, success rate, latency, cost)
 */

let composerClient: PrismaClient | null = null;

export function getComposerDb(): PrismaClient {
  if (!composerClient) {
    const url = process.env.COMPOSER_DATABASE_URL;
    if (!url) {
      throw new Error('COMPOSER_DATABASE_URL not configured');
    }

    composerClient = new PrismaClient({
      datasources: {
        db: { url },
      },
      log: ['error'],
    });
  }
  return composerClient;
}

/**
 * Execute a raw query against the Composer database
 */
export async function queryComposer<T>(query: string): Promise<T[]> {
  const client = getComposerDb();
  return client.$queryRawUnsafe(query) as Promise<T[]>;
}

/**
 * Check if Composer DB is configured
 */
export function isComposerDbConfigured(): boolean {
  return !!process.env.COMPOSER_DATABASE_URL;
}
