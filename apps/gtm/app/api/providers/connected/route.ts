/**
 * Connected Providers API
 * 
 * List which providers are connected for the workspace.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

/**
 * GET /api/providers/connected
 * Get list of connected providers
 */
export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ providers: [] }, { status: 401 })
  }

  const { data: membership } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', user.id)
    .single()

  if (!membership) {
    return NextResponse.json({ providers: [] }, { status: 404 })
  }
  
  const { data: connections, error } = await supabase
    .from('provider_connections')
    .select('provider')
    .eq('workspace_id', membership.workspace_id)
    .eq('is_active', true)
  
  if (error) {
    console.error('Failed to fetch connections:', error)
    return NextResponse.json({ providers: [] })
  }
  
  const providers = connections.map(c => c.provider)
  
  return NextResponse.json({ providers, connectedIds: providers })
}
