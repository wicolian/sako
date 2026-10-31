import { PrismaClient } from '@prisma/client';

/**
 * Separate Prisma client for the Sako-v1 database (READ-ONLY)
 * 
 * This connects to the sako-v1 production database to read:
 * - Users (signups, activation)
 * - Tasks (pipeline status, SLA)
 * - Workspaces (subscription status, churn risk)
 * - TaskLifecycleEvent (SLA timing)
 */

// Note: We need to use raw SQL queries because Prisma client 
// is generated against our Wall schema, not the Sako-v1 schema.
// For a cleaner solution, consider using a separate Prisma schema
// or using a raw query client.

// For now, we'll use raw SQL via the wall db client's $queryRawUnsafe
// but point to the sako_db URL directly.

// Alternative: Create a separate @prisma/client instance for sako-v1
// This would require multiple schema files and generated clients

let sakoClient: PrismaClient | null = null;

export function getSakoDb(): PrismaClient {
  if (!sakoClient) {
    const url = process.env.SAKO_DATABASE_URL;
    if (!url) {
      throw new Error('SAKO_DATABASE_URL not configured');
    }

    // Create a client pointing to sako-v1 database
    // Note: This client uses the Wall schema types, but we'll use raw queries
    sakoClient = new PrismaClient({
      datasources: {
        db: { url },
      },
      log: ['error'],
    });
  }
  return sakoClient;
}

/**
 * Execute a raw query against the Sako database
 */
export async function querySako<T>(query: string): Promise<T[]> {
  const client = getSakoDb();
  return client.$queryRawUnsafe(query) as Promise<T[]>;
}

/**
 * Check if Sako DB is configured
 */
export function isSakoDbConfigured(): boolean {
  return !!process.env.SAKO_DATABASE_URL;
}
