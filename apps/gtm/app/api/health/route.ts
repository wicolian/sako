/**
 * System Health API
 * 
 * Endpoints for monitoring provider and system health.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import {
  checkProviderHealth,
  checkAllProviderHealth,
  getCachedProviderHealth,
  updateProviderHealth,
  getProviderUptime,
  getSystemHealth,
  getHealthCheckProviders,
} from '@/lib/health/provider-health'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const action = searchParams.get('action')
  const provider = searchParams.get('provider')

  // System health is public (no auth required)
  if (action === 'system') {
    const health = await getSystemHealth()
    return NextResponse.json(health)
  }

  // Cached status is public
  if (action === 'status') {
    const status = await getCachedProviderHealth()
    return NextResponse.json({ providers: status })
  }

  // Provider list is public
  if (action === 'providers') {
    const providers = getHealthCheckProviders()
    return NextResponse.json({ providers })
  }

  // Uptime requires provider param
  if (action === 'uptime' && provider) {
    const hours = parseInt(searchParams.get('hours') || '24')
    const uptime = await getProviderUptime(provider, hours)
    return NextResponse.json({ provider, ...uptime })
  }

  // Fresh check (authenticated only)
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    // Return cached for unauthenticated
    const status = await getCachedProviderHealth()
    return NextResponse.json({ providers: status })
  }

  if (provider) {
    const health = await checkProviderHealth(provider)
    await updateProviderHealth(health)
    return NextResponse.json({ health })
  }

  // Check all providers
  const allHealth = await checkAllProviderHealth()
  for (const health of allHealth) {
    await updateProviderHealth(health)
  }
  return NextResponse.json({ providers: allHealth })
}

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Check if admin
  const { data: member } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (!member || member.role !== 'admin') {
    return NextResponse.json({ error: 'Admin required' }, { status: 403 })
  }

  const body = await request.json()
  const { action } = body

  switch (action) {
    case 'refreshAll': {
      const allHealth = await checkAllProviderHealth()
      for (const health of allHealth) {
        await updateProviderHealth(health)
      }
      return NextResponse.json({ providers: allHealth })
    }

    case 'refresh': {
      const { provider } = body
      if (!provider) {
        return NextResponse.json({ error: 'provider required' }, { status: 400 })
      }
      const health = await checkProviderHealth(provider)
      await updateProviderHealth(health)
      return NextResponse.json({ health })
    }

    default:
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }
}
