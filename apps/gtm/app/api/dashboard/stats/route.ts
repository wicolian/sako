/**
 * Dashboard Stats API (Jan 2026)
 * 
 * Returns aggregated statistics for the dashboard overview.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getWorkspaceIdWithFallback } from '@/lib/workspace'

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const db = createServiceClient()
    
    let workspaceId: string
    try {
      workspaceId = getWorkspaceIdWithFallback(request)
    } catch {
      // Get from membership
      const { data: membership } = await db
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_id', userId)
        .single()
      
      if (!membership) {
        return NextResponse.json({ 
          campaigns: { total: 0, draft: 0, ready: 0, published: 0, running: 0 },
          claims: { total: 0, approved: 0, needsProof: 0, blocked: 0, draft: 0, avgRiskScore: 0 },
          evidence: { total: 0, tierA: 0, tierB: 0, tierC: 0 },
          deployments: { total: 0, successful: 0, failed: 0, pending: 0 },
          performance: { pageViews: 0, conversions: 0, conversionRate: 0, formSubmissions: 0 },
          recentActivity: [],
          complianceScore: 100,
          healthScore: 0,
          lastUpdated: new Date().toISOString(),
        })
      }
      workspaceId = membership.workspace_id
    }

    // Fetch all stats in parallel
    const [
      campaignsResult,
      claimsResult,
      evidenceResult,
      deploymentsResult,
      recentActivityResult,
      performanceResult,
    ] = await Promise.all([
      // Campaign stats
      db.from('campaigns')
        .select('id, status')
        .eq('workspace_id', workspaceId),
      
      // Claims stats
      db.from('claims')
        .select('id, status, risk_score')
        .eq('workspace_id', workspaceId),
      
      // Evidence stats
      db.from('evidence')
        .select('id, tier')
        .eq('workspace_id', workspaceId),
      
      // Deployment stats (last 30 days)
      db.from('deployments')
        .select('id, status, created_at')
        .eq('workspace_id', workspaceId),
      
      // Recent activity (last 7 days)
      db.from('audit_log')
        .select('id, action, entity_type, created_at')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false })
        .limit(10),
      
      // Performance metrics
      db.from('performance')
        .select('metrics, captured_at')
        .eq('workspace_id', workspaceId)
        .order('captured_at', { ascending: false })
        .limit(30),
    ])

    // Process campaign stats
    const campaigns = (campaignsResult.data || []) as Array<{ id: string; status: string }>
    const campaignStats = {
      total: campaigns.length,
      draft: campaigns.filter(c => c.status === 'draft').length,
      ready: campaigns.filter(c => c.status === 'ready').length,
      published: campaigns.filter(c => c.status === 'published').length,
      running: campaigns.filter(c => c.status === 'running').length,
    }

    // Process claims stats
    const claims = (claimsResult.data || []) as Array<{ id: string; status: string; risk_score: number | null }>
    const claimStats = {
      total: claims.length,
      approved: claims.filter(c => c.status === 'approved').length,
      needsProof: claims.filter(c => c.status === 'needs_proof').length,
      blocked: claims.filter(c => c.status === 'blocked').length,
      draft: claims.filter(c => c.status === 'draft').length,
      avgRiskScore: claims.length > 0
        ? Math.round(claims.reduce((sum, c) => sum + (c.risk_score || 0), 0) / claims.length)
        : 0,
    }

    // Process evidence stats
    const evidence = (evidenceResult.data || []) as Array<{ id: string; tier: string }>
    const evidenceStats = {
      total: evidence.length,
      tierA: evidence.filter(e => e.tier === 'A').length,
      tierB: evidence.filter(e => e.tier === 'B').length,
      tierC: evidence.filter(e => e.tier === 'C').length,
    }

    // Process deployment stats
    const deployments = (deploymentsResult.data || []) as Array<{ id: string; status: string; created_at: string }>
    const deploymentStats = {
      total: deployments.length,
      successful: deployments.filter(d => d.status === 'success').length,
      failed: deployments.filter(d => d.status === 'failed').length,
      pending: deployments.filter(d => d.status === 'pending').length,
    }

    // Process performance metrics
    const performanceData = (performanceResult.data || []) as Array<{ metrics: Record<string, number>; captured_at: string }>
    const latestMetrics = performanceData[0]?.metrics || {}
    const performanceStats = {
      pageViews: latestMetrics.pageViews || 0,
      conversions: latestMetrics.conversions || 0,
      conversionRate: latestMetrics.conversionRate || 0,
      formSubmissions: latestMetrics.formSubmissions || 0,
    }

    // Calculate compliance score
    const complianceScore = claimStats.total > 0
      ? Math.round((claimStats.approved / claimStats.total) * 100)
      : 100

    // Calculate health score (composite)
    const healthScore = Math.round(
      (complianceScore * 0.4) +
      (evidenceStats.total > 0 ? 30 : 0) +
      (campaignStats.running > 0 ? 30 : 0)
    )

    return NextResponse.json({
      campaigns: campaignStats,
      claims: claimStats,
      evidence: evidenceStats,
      deployments: deploymentStats,
      performance: performanceStats,
      recentActivity: recentActivityResult.data || [],
      complianceScore,
      healthScore,
      lastUpdated: new Date().toISOString(),
    })

  } catch (error) {
    console.error('Dashboard stats error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch stats' },
      { status: 500 }
    )
  }
}
