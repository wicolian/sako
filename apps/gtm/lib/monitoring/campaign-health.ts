/**
 * Campaign Health Monitoring
 * 
 * Calculates health scores for campaigns based on:
 * - Compliance: How well claims comply with policy
 * - Freshness: How recently content was updated
 * - Performance: Engagement and conversion metrics
 */

import { createServiceClient } from '@/lib/supabase/service'

export interface CampaignHealthScore {
  overall: number
  factors: {
    compliance: number
    freshness: number
    /**
     * null when no analytics_events rows exist for this campaign yet.
     * The overall score is then computed from compliance + freshness only.
     */
    performance: number | null
  }
  alerts: string[]
}

/**
 * Get health score for a campaign
 */
export async function getCampaignHealthScore(
  campaignId: string
): Promise<CampaignHealthScore> {
  const supabase = createServiceClient()

  // Get campaign with related data
  const { data: campaign } = await supabase
    .from('campaigns')
    .select(`
      id,
      status,
      updated_at,
      messages (id, status),
      claims:messages!inner (claim_id)
    `)
    .eq('id', campaignId)
    .single()

  if (!campaign) {
    return {
      overall: 0,
      factors: { compliance: 0, freshness: 0, performance: 0 },
      alerts: ['Campaign not found'],
    }
  }

  // Calculate compliance score
  const messages = campaign.messages || []
  const totalMessages = messages.length
  const approvedMessages = messages.filter((m: { status: string }) => m.status === 'approved').length
  const blockedMessages = messages.filter((m: { status: string }) => m.status === 'blocked').length
  
  let complianceScore = 100
  if (totalMessages > 0) {
    complianceScore = Math.round((approvedMessages / totalMessages) * 100)
    // Heavily penalize blocked messages
    complianceScore -= blockedMessages * 20
    complianceScore = Math.max(0, complianceScore)
  }

  // Calculate freshness score
  const updatedAt = new Date(campaign.updated_at)
  const daysSinceUpdate = Math.floor((Date.now() - updatedAt.getTime()) / (1000 * 60 * 60 * 24))
  let freshnessScore = 100
  if (daysSinceUpdate > 90) freshnessScore = 30
  else if (daysSinceUpdate > 60) freshnessScore = 50
  else if (daysSinceUpdate > 30) freshnessScore = 70
  else if (daysSinceUpdate > 14) freshnessScore = 85

  // Fetch real performance from analytics_events.
  // TODO: once a background sync job populates the `performance` table
  // (supabase/migrations/001_initial_schema.sql) with aggregated JSONB metrics,
  // query that table instead for a single row lookup per campaign.
  const { data: analyticsEvents } = await supabase
    .from('analytics_events')
    .select('event_type')
    .eq('campaign_id', campaignId)

  let performanceScore: number | null = null

  if (analyticsEvents && analyticsEvents.length > 0) {
    const impressions = analyticsEvents.filter(
      (e: { event_type: string }) => e.event_type === 'impression'
    ).length
    const clicks = analyticsEvents.filter(
      (e: { event_type: string }) => e.event_type === 'click'
    ).length
    const conversions = analyticsEvents.filter(
      (e: { event_type: string }) => e.event_type === 'conversion'
    ).length

    const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0
    const conversionRate = clicks > 0 ? (conversions / clicks) * 100 : 0

    // Normalise to 0-100: CTR benchmark 2.5% = 100, conversion benchmark 3% = 100
    const ctrScore = Math.min(100, (ctr / 2.5) * 100)
    const convScore = Math.min(100, (conversionRate / 3.0) * 100)
    performanceScore = Math.round(ctrScore * 0.5 + convScore * 0.5)
  }
  // performanceScore remains null — no analytics_events rows yet.
  // The overall score is computed from compliance + freshness only so the
  // health value is honest rather than based on a status-based placeholder.

  // Calculate overall score (weighted average).
  // When performance data is absent, redistribute its 30% weight proportionally.
  let overall: number
  if (performanceScore === null) {
    const knownWeightTotal = 0.4 + 0.3 // compliance + freshness
    overall = Math.round(
      complianceScore * (0.4 / knownWeightTotal) +
      freshnessScore * (0.3 / knownWeightTotal)
    )
  } else {
    overall = Math.round(
      complianceScore * 0.4 +
      freshnessScore * 0.3 +
      performanceScore * 0.3
    )
  }

  // Generate alerts
  const alerts: string[] = []
  if (complianceScore < 50) alerts.push('Low compliance score - review blocked messages')
  if (freshnessScore < 50) alerts.push('Content is stale - consider refreshing')
  if (blockedMessages > 0) alerts.push(`${blockedMessages} message(s) blocked by policy`)
  if (daysSinceUpdate > 60) alerts.push('Campaign not updated in 60+ days')
  if (performanceScore === null) alerts.push('Performance metrics pending - no analytics events yet')

  return {
    overall,
    factors: {
      compliance: complianceScore,
      freshness: freshnessScore,
      performance: performanceScore,
    },
    alerts,
  }
}

/**
 * Get health summary for all campaigns in a workspace
 */
export async function getWorkspaceHealthSummary(
  workspaceId: string
): Promise<{
  averageHealth: number
  campaignsAtRisk: number
  totalCampaigns: number
}> {
  const supabase = createServiceClient()

  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id')
    .eq('workspace_id', workspaceId)
    .neq('status', 'archived')

  if (!campaigns || campaigns.length === 0) {
    return { averageHealth: 100, campaignsAtRisk: 0, totalCampaigns: 0 }
  }

  let totalHealth = 0
  let atRisk = 0

  for (const campaign of campaigns) {
    const health = await getCampaignHealthScore(campaign.id)
    totalHealth += health.overall
    if (health.overall < 60) atRisk++
  }

  return {
    averageHealth: Math.round(totalHealth / campaigns.length),
    campaignsAtRisk: atRisk,
    totalCampaigns: campaigns.length,
  }
}
