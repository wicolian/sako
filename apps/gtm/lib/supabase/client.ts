/**
 * Browser Client - Clerk Auth (No Supabase)
 * 
 * MIGRATED: This file is kept for compatibility but Supabase is no longer used.
 * Authentication is handled by Clerk, database by Neon.
 * 
 * For client-side data fetching, use React Query with API routes.
 */

// This file is deprecated - use Clerk for auth and API routes for data
console.warn(
  'lib/supabase/client.ts is deprecated. ' +
  'Use Clerk for authentication and API routes for data fetching.'
);

// Stub function to prevent import errors
export function createClient() {
  throw new Error(
    'createClient() is deprecated. ' +
    'Use Clerk for authentication (@clerk/nextjs) and ' +
    'fetch API routes for data operations.'
  );
}
