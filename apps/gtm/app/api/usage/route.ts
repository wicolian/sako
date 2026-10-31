/**
 * Usage Metering API
 * 
 * GET /api/usage - Get current usage and limits
 * POST /api/usage - Track usage event
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerUser, getUserWorkspace } from '@/lib/supabase/auth-server'
import { usageMetering, type UsageLimits } from '@/lib/enterprise/usage-metering'

export async function GET() {
  try {
    const user = await getServerUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const workspace = await getUserWorkspace(user.id)
    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
    }

    // Get full dashboard data
    const dashboard = await usageMetering.getUsageDashboard(workspace.workspaceId)
    const alerts = await usageMetering.getUsageAlerts(workspace.workspaceId)

    return NextResponse.json({
      limits: dashboard.limits,
      current: dashboard.current,
      breakdown: dashboard.breakdown,
      costEstimate: dashboard.costEstimate,
      alerts,
    })
  } catch (error) {
    console.error('Get usage error:', error)
    return NextResponse.json({ error: 'Failed to get usage' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getServerUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const workspace = await getUserWorkspace(user.id)
    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
    }

    const body = await request.json()
    const {
      eventType,
      eventSubtype,
      units,
      tokensUsed,
      costUsd,
      resourceType,
      resourceId,
      metadata,
    } = body

    if (!eventType) {
      return NextResponse.json({ error: 'eventType is required' }, { status: 400 })
    }

    const allowed = await usageMetering.trackUsage(
      workspace.workspaceId,
      user.id,
      eventType,
      {
        eventSubtype,
        units,
        tokensUsed,
        costUsd,
        resourceType,
        resourceId,
        metadata,
      }
    )

    if (!allowed) {
      // Get current limits to show in error
      const check = await usageMetering.checkUsage(
        workspace.workspaceId,
        eventType as keyof UsageLimits
      )
      return NextResponse.json(
        {
          error: 'Usage limit exceeded',
          current: check.current,
          limit: check.limit,
          upgradeRequired: check.upgradeRequired,
        },
        { status: 429 }
      )
    }

    return NextResponse.json({ tracked: true })
  } catch (error) {
    console.error('Track usage error:', error)
    return NextResponse.json({ error: 'Failed to track usage' }, { status: 500 })
  }
}
