/**
 * Provider Health Monitoring API
 * 
 * GET /api/monitoring/health - Get all provider health
 * POST /api/monitoring/health/refresh - Trigger health checks
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import {
  PROVIDERS,
  getAllProviderHealth,
  checkProviderHealth,
  storeHealthCheck,
  getHealthChecks,
  evaluateStatus,
  calculateUptime,
  calculateAverageLatency,
  type ProviderHealth,
} from '@/lib/monitoring/provider-health'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get workspace membership to verify user has access
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('workspace_id, role')
      .eq('user_id', user.id)
      .single()

    if (!membership) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 404 })
    }

    // Only admins can view provider health
    if (membership.role !== 'owner' && membership.role !== 'admin') {
      return NextResponse.json(
        { error: 'Only admins can view provider health' },
        { status: 403 }
      )
    }

    // Get health for all providers
    const providers: ProviderHealth[] = []
    
    for (const provider of PROVIDERS) {
      const checks = await getHealthChecks(provider.id, 100)
      const currentCheck = checks[0]
      
      providers.push({
        provider,
        currentStatus: evaluateStatus(checks),
        latencyMs: calculateAverageLatency(checks),
        errorRate: currentCheck?.errorRate || 0,
        uptime30Days: calculateUptime(checks),
        lastCheck: currentCheck?.checkedAt || new Date().toISOString(),
        recentIncidents: [],
        history: checks.slice(0, 24),
      })
    }

    // Calculate overall summary
    const healthyCount = providers.filter(p => p.currentStatus === 'healthy').length
    const degradedCount = providers.filter(p => p.currentStatus === 'degraded').length
    const downCount = providers.filter(p => p.currentStatus === 'down').length

    return NextResponse.json({
      success: true,
      providers,
      summary: {
        total: providers.length,
        healthy: healthyCount,
        degraded: degradedCount,
        down: downCount,
        overallStatus: downCount > 0 ? 'down' : degradedCount > 0 ? 'degraded' : 'healthy',
      },
    })
  } catch (error) {
    console.error('Error fetching provider health:', error)
    return NextResponse.json(
      { error: 'Failed to fetch provider health' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get workspace membership
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('workspace_id, role')
      .eq('user_id', user.id)
      .single()

    if (!membership) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 404 })
    }

    // Only admins can trigger health checks
    if (membership.role !== 'owner' && membership.role !== 'admin') {
      return NextResponse.json(
        { error: 'Only admins can trigger health checks' },
        { status: 403 }
      )
    }

    // Run health checks for all providers in parallel
    const checkPromises = PROVIDERS.map(async (provider) => {
      const check = await checkProviderHealth(provider)
      await storeHealthCheck(check)
      return { providerId: provider.id, check }
    })

    const results = await Promise.all(checkPromises)

    return NextResponse.json({
      success: true,
      message: 'Health checks completed',
      results: results.map(r => ({
        providerId: r.providerId,
        status: r.check.status,
        latencyMs: r.check.latencyMs,
      })),
    })
  } catch (error) {
    console.error('Error running health checks:', error)
    return NextResponse.json(
      { error: 'Failed to run health checks' },
      { status: 500 }
    )
  }
}
