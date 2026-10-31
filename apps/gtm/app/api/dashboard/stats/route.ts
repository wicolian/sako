/**
 * Dashboard Stats API (Jan 2026)
 * 
 * Returns aggregated statistics for the dashboard overview.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getWorkspaceIdWithFallback } from '@/lib/workspace'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const workspaceId = getWorkspaceIdWithFallback(request)

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
      supabase
        .from('campaigns')
        .select('id, status', { count: 'exact' })
        .eq('workspace_id', workspaceId),
      
      // Claims stats
      supabase
        .from('claims')
        .select('id, status, risk_score', { count: 'exact' })
        .eq('workspace_id', workspaceId),
      
      // Evidence stats
      supabase
        .from('evidence')
        .select('id, tier', { count: 'exact' })
        .eq('workspace_id', workspaceId),
      
      // Deployment stats (last 30 days)
      supabase
        .from('deployments')
        .select('id, status, created_at')
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
      
      // Recent activity (last 7 days)
      supabase
        .from('audit_log')
        .select('id, action, entity_type, created_at')
        .eq('workspace_id', workspaceId)
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false })
        .limit(10),
      
      // Performance metrics
      supabase
        .from('performance')
        .select('metrics, captured_at')
        .order('captured_at', { ascending: false })
        .limit(30),
    ])

    // Process campaign stats
    const campaigns = campaignsResult.data || []
    const campaignStats = {
      total: campaignsResult.count || 0,
      draft: campaigns.filter(c => c.status === 'draft').length,
      ready: campaigns.filter(c => c.status === 'ready').length,
      published: campaigns.filter(c => c.status === 'published').length,
      running: campaigns.filter(c => c.status === 'running').length,
    }

    // Process claims stats
    const claims = claimsResult.data || []
    const claimStats = {
      total: claimsResult.count || 0,
      approved: claims.filter(c => c.status === 'approved').length,
      needsProof: claims.filter(c => c.status === 'needs_proof').length,
      blocked: claims.filter(c => c.status === 'blocked').length,
      draft: claims.filter(c => c.status === 'draft').length,
      avgRiskScore: claims.length > 0
        ? Math.round(claims.reduce((sum, c) => sum + (c.risk_score || 0), 0) / claims.length)
        : 0,
    }

    // Process evidence stats
    const evidence = evidenceResult.data || []
    const evidenceStats = {
      total: evidenceResult.count || 0,
      tierA: evidence.filter(e => e.tier === 'A').length,
      tierB: evidence.filter(e => e.tier === 'B').length,
      tierC: evidence.filter(e => e.tier === 'C').length,
    }

    // Process deployment stats
    const deployments = deploymentsResult.data || []
    const deploymentStats = {
      total: deployments.length,
      successful: deployments.filter(d => d.status === 'success').length,
      failed: deployments.filter(d => d.status === 'failed').length,
      pending: deployments.filter(d => d.status === 'pending').length,
    }

    // Process performance metrics
    const performanceData = performanceResult.data || []
    const latestMetrics = performanceData[0]?.metrics as Record<string, number> | null
    const performanceStats = {
      pageViews: latestMetrics?.pageViews || 0,
      conversions: latestMetrics?.conversions || 0,
      conversionRate: latestMetrics?.conversionRate || 0,
      formSubmissions: latestMetrics?.formSubmissions || 0,
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
