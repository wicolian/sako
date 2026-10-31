/**
 * Server Client - Neon PostgreSQL
 * 
 * MIGRATED: This now uses Neon instead of Supabase.
 * For server components, use the db client from @/lib/db.
 */

import { db } from '@/lib/db';

/**
 * Create a server-side database client
 * 
 * This provides a Supabase-compatible query builder backed by Neon.
 * Use in server components, route handlers, or server actions.
 */
export async function createServiceClient() {
  // Return the Neon-backed db client
  return db;
}

// Alias for backward compatibility
export const createClient = createServerSupabaseClient
