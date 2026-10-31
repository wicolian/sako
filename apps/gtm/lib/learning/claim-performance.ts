/**
 * Claim Performance Learning Loop
 * 
 * Tracks claim performance metrics and provides learning data
 * to enhance AI prompt generation over time.
 */

import crypto from 'crypto'
import { createServiceClient } from '@/lib/supabase/service'

export interface ClaimPerformance {
  claim_text: string
  conversion_rate: number
  performance_score: number
  impressions: number
  conversions: number
  confidence_level: 'low' | 'medium' | 'high'
  category: string
}

export interface TopClaimsResult {
  claims: ClaimPerformance[]
  hasData: boolean
  minImpressions: number
}

/**
 * Generate a consistent hash for a claim to enable deduplication
 */
export function hashClaim(text: string): string {
  // Normalize: lowercase, trim, collapse whitespace
  const normalized = text.toLowerCase().trim().replace(/\s+/g, ' ')
  return crypto.createHash('sha256').update(normalized).digest('hex')
}

/**
 * Record an impression for a claim (page view, email open, etc.)
 */
export async function recordClaimImpression(
  workspaceId: string,
  claimText: string,
  campaignId?: string,
  category: string = 'generic'
): Promise<void> {
  const supabase = createServiceClient()
  const claimHash = hashClaim(claimText)

  try {
    await supabase.rpc('record_claim_impression', {
      p_workspace_id: workspaceId,
      p_claim_hash: claimHash,
      p_claim_text: claimText,
      p_campaign_id: campaignId || null,
      p_category: category,
    })
  } catch (error) {
    console.error('Failed to record claim impression:', error)
    // Non-blocking - don't throw
  }
}

/**
 * Record a conversion for a claim (form submission, signup, etc.)
 */
export async function recordClaimConversion(
  workspaceId: string,
  claimText: string,
  campaignId?: string
): Promise<void> {
  const supabase = createServiceClient()
  const claimHash = hashClaim(claimText)

  try {
    await supabase.rpc('record_claim_conversion', {
      p_workspace_id: workspaceId,
      p_claim_hash: claimHash,
      p_campaign_id: campaignId || null,
    })
  } catch (error) {
    console.error('Failed to record claim conversion:', error)
    // Non-blocking - don't throw
  }
}

/**
 * Get top performing claims for a workspace
 * Used to inject into AI prompts for learning
 */
export async function getTopPerformingClaims(
  workspaceId: string,
  limit: number = 10,
  minImpressions: number = 100,
  category?: string
): Promise<TopClaimsResult> {
  const supabase = createServiceClient()

  try {
    const { data, error } = await supabase.rpc('get_top_performing_claims', {
      p_workspace_id: workspaceId,
      p_limit: limit,
      p_min_impressions: minImpressions,
      p_category: category || null,
    })

    if (error) {
      console.error('Failed to get top performing claims:', error)
      return { claims: [], hasData: false, minImpressions }
    }

    return {
      claims: (data || []) as ClaimPerformance[],
      hasData: (data?.length || 0) > 0,
      minImpressions,
    }
  } catch (error) {
    console.error('Failed to get top performing claims:', error)
    return { claims: [], hasData: false, minImpressions }
  }
}

/**
 * Get performance insights for a specific campaign
 */
export async function getCampaignClaimPerformance(
  campaignId: string
): Promise<ClaimPerformance[]> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('claim_performance')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('performance_score', { ascending: false })

  if (error) {
    console.error('Failed to get campaign claim performance:', error)
    return []
  }

  return data as ClaimPerformance[]
}

/**
 * Record impressions for all claims in page blocks
 */
export async function recordPageBlockImpressions(
  workspaceId: string,
  campaignId: string,
  blocks: Array<{ type: string; props: Record<string, unknown> }>
): Promise<void> {
  const claims: string[] = []

  for (const block of blocks) {
    // Extract text from different block types
    switch (block.type) {
      case 'hero':
        if (block.props.headline) claims.push(block.props.headline as string)
        if (block.props.subheadline) claims.push(block.props.subheadline as string)
        break
      case 'benefits':
        const items = block.props.items as Array<{ title?: string; description?: string }> || []
        items.forEach(item => {
          if (item.title) claims.push(item.title)
          if (item.description) claims.push(item.description)
        })
        break
      case 'features':
        const features = block.props.items as Array<{ title?: string; description?: string }> || []
        features.forEach(item => {
          if (item.title) claims.push(item.title)
          if (item.description) claims.push(item.description)
        })
        break
      case 'footer_cta':
        if (block.props.headline) claims.push(block.props.headline as string)
        break
    }
  }

  // Record all claims in parallel (non-blocking)
  await Promise.all(
    claims.map(claim =>
      recordClaimImpression(workspaceId, claim, campaignId, 'generic')
    )
  )
}

/**
 * Batch update performance metrics from external analytics
 * (e.g., from HubSpot, Segment, or PostHog)
 */
export async function batchUpdatePerformance(
  workspaceId: string,
  updates: Array<{
    claimText: string
    impressions: number
    conversions: number
  }>
): Promise<void> {
  const supabase = createServiceClient()

  for (const update of updates) {
    const claimHash = hashClaim(update.claimText)

    await supabase
      .from('claim_performance')
      .upsert(
        {
          workspace_id: workspaceId,
          claim_hash: claimHash,
          claim_text: update.claimText,
          impressions: update.impressions,
          conversions: update.conversions,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'claim_hash,workspace_id' }
      )
  }
}

/**
 * Calculate performance score from metrics
 * Higher score = better performing claim
 */
export function calculatePerformanceScore(
  impressions: number,
  conversions: number
): number {
  if (impressions < 50) {
    // Not enough data, return neutral score
    return 50
  }

  const conversionRate = conversions / impressions

  // Score formula:
  // Base: 50
  // Conversion rate contribution: up to 50 points
  // Capped at 0-100
  const score = 50 + Math.round(conversionRate * 100 * 5)
  return Math.min(100, Math.max(0, score))
}
