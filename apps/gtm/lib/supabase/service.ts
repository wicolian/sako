/**
 * Service Client - Neon PostgreSQL
 * 
 * MIGRATED: This now uses Neon instead of Supabase.
 * The API remains compatible with the old Supabase service client.
 * 
 * All existing imports of createServiceClient() will now use Neon.
 */

import { db, createServiceClient as createNeonServiceClient } from '@/lib/db';

/**
 * Create a service client for API routes
 * 
 * This provides a Supabase-compatible query builder backed by Neon.
 * Safe to import from any server context.
 */
export function createServiceClient() {
  return createNeonServiceClient();
}

// Re-export db for direct access
export { db };
