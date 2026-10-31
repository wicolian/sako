import { createServerClient } from '@supabase/ssr'

/**
 * Create a Supabase service client for API routes
 * Does NOT use next/headers - safe to import from any server context
 * REQUIRES service role key for admin operations
 */
export function createServiceClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!serviceRoleKey) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is required for service client operations. ' +
      'Get it from your Supabase dashboard (Settings > API > service_role key) and add to .env.local'
    )
  }
  
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    {
      cookies: {
        getAll() {
          return []
        },
        setAll() {},
      },
    }
  )
}
