/**
 * Usage Metering System
 * 
 * Tracks and enforces usage limits for AI generations,
 * deployments, API calls, animport { Database } from '@/lib/supabase/types'

type WorkspaceRow = Database['public']['Tables']['workspaces']['Row']
type CampaignRow = Database['public']['Tables']['campaigns']['Row']
type WorkspaceMemberRow = Database['public']['Tables']['workspace_members']['Row']
d other metered features.
 */

import { createServiceClient } from '@/lib/supabase/service'
import { PLANS, normalizePlanId, type PlanId } from '@/lib/billing/plans'

export interface UsageLimits {
  aiGenerations: number | 'unlimited'
  campaigns: number | 'unlimited'
  brands: number | 'unlimited'
  teamSeats: number | 'unlimited'
  apiCalls: number | 'unlimited'
  sakoTasks: number | 'unlimited'
  publishes: number | 'unlimited'
}

export interface CurrentUsage {
  aiGenerations: number
  campaigns: number
  brands: number
  teamSeats: number
  apiCalls: number
  sakoTasks: number
  publishes: number
  periodStart: Date
  periodEnd: Date
}

export interface UsageResult {
  allowed: boolean
  current: number
  limit: number | 'unlimited'
  remaining: number | 'unlimited'
  percentUsed: number
  resetDate: Date
  upgradeRequired?: string // Suggested plan if limit reached
}

class UsageMeteringService {
  private _supabase: ReturnType<typeof createServiceClient> | null = null
  
  private get supabase() {
    if (!this._supabase) {
      this._supabase = createServiceClient()
    }
    return this._supabase
  }

  /**
   * Check if a specific usage type is allowed
   */
  async checkUsage(
    workspaceId: string,
    usageType: keyof UsageLimits
  ): Promise<UsageResult> {
    const [limits, current] = await Promise.all([
      this.getUsageLimits(workspaceId),
      this.getCurrentUsage(workspaceId),
    ])

    const limit = limits[usageType]
    const used = current[usageType]

    if (limit === 'unlimited') {
      return {
        allowed: true,
        current: used,
        limit: 'unlimited',
        remaining: 'unlimited',
        percentUsed: 0,
        resetDate: current.periodEnd,
      }
    }

    const allowed = used < limit
    const remaining = Math.max(0, limit - used)
    const percentUsed = (used / limit) * 100

    let upgradeRequired: string | undefined
    if (!allowed) {
      upgradeRequired = this.getSuggestedUpgrade(usageType, limit)
    }

    return {
      allowed,
      current: used,
      limit,
      remaining,
      percentUsed,
      resetDate: current.periodEnd,
      upgradeRequired,
    }
  }

  /**
   * Track a usage event
   */
  async trackUsage(
    workspaceId: string,
    userId: string,
    eventType: string,
    options: {
      eventSubtype?: string
      units?: number
      tokensUsed?: number
      costUsd?: number
      resourceType?: string
      resourceId?: string
      metadata?: Record<string, any>
    } = {}
  ): Promise<boolean> {
    try {
      // First check if allowed
      const usageType = this.mapEventToUsageType(eventType)
      if (usageType) {
        const check = await this.checkUsage(workspaceId, usageType)
        if (!check.allowed) {
          return false
        }
      }

      // Track the event via database function
      await this.supabase.rpc('track_usage_event', {
        p_workspace_id: workspaceId,
        p_user_id: userId,
        p_event_type: eventType,
        p_event_subtype: options.eventSubtype || null,
        p_units: options.units || 1,
        p_tokens: options.tokensUsed || null,
        p_cost: options.costUsd || null,
        p_metadata: options.metadata || {},
      })

      return true
    } catch (error) {
      console.error('Failed to track usage:', error)
      return true // Don't block on tracking failures
    }
  }

  /**
   * Get usage limits for a workspace based on their plan
   */
  async getUsageLimits(workspaceId: string): Promise<UsageLimits> {
    // Get workspace subscription
    const { data: workspace } = await this.supabase
      .from('workspaces')
      .select('subscription:subscriptions(plan_id)')
      .eq('id', workspaceId)
      .maybeSingle()

    const planId = normalizePlanId((workspace?.subscription as any)?.plan_id || 'free')
    const plan = PLANS[planId as PlanId] || PLANS.free

    return {
      aiGenerations: plan.limits.aiGenerationsPerMonth || plan.limits.apiCalls,
      campaigns: plan.limits.campaignsPerMonth || plan.limits.campaigns,
      brands: plan.limits.brands || 1,
      teamSeats: plan.limits.teamSeats || 1,
      apiCalls: plan.limits.apiCallsPerMonth || plan.limits.apiCalls || 10000,
      sakoTasks: plan.limits.sakoEscalation ? 'unlimited' : 0,
      publishes: plan.limits.publishesPerMonth || 0,
    }
  }

  /**
   * Get current period usage for a workspace
   */
  async getCurrentUsage(workspaceId: string): Promise<CurrentUsage> {
    const now = new Date()
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)

    // Get aggregated usage
    const { data: aggregate } = await this.supabase
      .from('usage_aggregates')
      .select('*')
      .eq('workspace_id', workspaceId)
      .gte('period_start', periodStart.toISOString().split('T')[0])
      .maybeSingle()

    // Get current counts for non-event-based limits
    const [campaignsResult, brandsResult, membersResult] = await Promise.all([
      this.supabase
        .from('campaigns')
        .select('id', { count: 'exact' })
        .eq('workspace_id', workspaceId)
        .gte('created_at', periodStart.toISOString()),
      this.supabase
        .from('brands')
        .select('id', { count: 'exact' })
        .eq('workspace_id', workspaceId),
      this.supabase
        .from('workspace_members')
        .select('id', { count: 'exact' })
        .eq('workspace_id', workspaceId),
    ])

    return {
      aiGenerations: aggregate?.ai_generations || 0,
      campaigns: campaignsResult.count || 0,
      brands: brandsResult.count || 0,
      teamSeats: membersResult.count || 0,
      apiCalls: aggregate?.api_calls || 0,
      sakoTasks: aggregate?.sako_tasks || 0,
      publishes: aggregate?.deployments || 0,
      periodStart,
      periodEnd,
    }
  }

  /**
   * Get usage dashboard data
   */
  async getUsageDashboard(workspaceId: string): Promise<{
    limits: UsageLimits
    current: CurrentUsage
    breakdown: { date: string; aiGenerations: number; deployments: number }[]
    costEstimate: number
  }> {
    const [limits, current] = await Promise.all([
      this.getUsageLimits(workspaceId),
      this.getCurrentUsage(workspaceId),
    ])

    // Get daily breakdown for the current period
    const { data: dailyUsage } = await this.supabase
      .from('usage_events')
      .select('created_at, event_type, units_consumed')
      .eq('workspace_id', workspaceId)
      .gte('created_at', current.periodStart.toISOString())
      .order('created_at', { ascending: true })

    // Group by date
    const breakdown: Record<string, { aiGenerations: number; deployments: number }> = {}
    
    for (const event of dailyUsage || []) {
      const date = event.created_at.split('T')[0]
      if (!breakdown[date]) {
        breakdown[date] = { aiGenerations: 0, deployments: 0 }
      }
      if (event.event_type === 'ai_generation') {
        breakdown[date].aiGenerations += event.units_consumed
      }
      if (event.event_type === 'deployment') {
        breakdown[date].deployments += event.units_consumed
      }
    }

    // Get cost estimate
    const { data: aggregate } = await this.supabase
      .from('usage_aggregates')
      .select('total_cost_usd')
      .eq('workspace_id', workspaceId)
      .gte('period_start', current.periodStart.toISOString().split('T')[0])
      .maybeSingle()

    return {
      limits,
      current,
      breakdown: Object.entries(breakdown).map(([date, data]) => ({
        date,
        ...data,
      })),
      costEstimate: aggregate?.total_cost_usd || 0,
    }
  }

  /**
   * Check if workspace is approaching limits
   */
  async getUsageAlerts(workspaceId: string): Promise<{
    type: keyof UsageLimits
    percentUsed: number
    message: string
  }[]> {
    const [limits, current] = await Promise.all([
      this.getUsageLimits(workspaceId),
      this.getCurrentUsage(workspaceId),
    ])

    const alerts: { type: keyof UsageLimits; percentUsed: number; message: string }[] = []
    const threshold = 80 // Alert at 80% usage

    const checkLimit = (type: keyof UsageLimits, used: number, limit: number | 'unlimited') => {
      if (limit === 'unlimited') return
      const percentUsed = (used / limit) * 100
      if (percentUsed >= threshold) {
        alerts.push({
          type,
          percentUsed,
          message: percentUsed >= 100
            ? `You've reached your ${type} limit`
            : `You're at ${Math.round(percentUsed)}% of your ${type} limit`,
        })
      }
    }

    checkLimit('aiGenerations', current.aiGenerations, limits.aiGenerations)
    checkLimit('campaigns', current.campaigns, limits.campaigns)
    checkLimit('brands', current.brands, limits.brands)
    checkLimit('teamSeats', current.teamSeats, limits.teamSeats)
    checkLimit('apiCalls', current.apiCalls, limits.apiCalls)

    return alerts.sort((a, b) => b.percentUsed - a.percentUsed)
  }

  // Helper methods
  private mapEventToUsageType(eventType: string): keyof UsageLimits | null {
    const mapping: Record<string, keyof UsageLimits> = {
      ai_generation: 'aiGenerations',
      deployment: 'campaigns',
      api_call: 'apiCalls',
      sako_task: 'sakoTasks',
    }
    return mapping[eventType] || null
  }

  private getSuggestedUpgrade(usageType: keyof UsageLimits, currentLimit: number): string {
    // Suggest upgrade based on what they're hitting
    if (usageType === 'aiGenerations') {
      if (currentLimit < 500) return 'pro'
      if (currentLimit < 2500) return 'max'
      return 'enterprise'
    }
    if (usageType === 'teamSeats') {
      if (currentLimit < 5) return 'pro'
      return 'max'
    }
    return 'pro'
  }
}

// Singleton
export const usageMetering = new UsageMeteringService()

/**
 * Middleware helper to check usage before operations
 */
export async function enforceUsageLimit(
  workspaceId: string,
  usageType: keyof UsageLimits
): Promise<{ allowed: boolean; error?: string }> {
  const result = await usageMetering.checkUsage(workspaceId, usageType)
  
  if (!result.allowed) {
    return {
      allowed: false,
      error: `You've reached your ${usageType} limit. ${
        result.upgradeRequired
          ? `Upgrade to ${result.upgradeRequired} to continue.`
          : `Limit resets on ${result.resetDate.toLocaleDateString()}.`
      }`,
    }
  }

  return { allowed: true }
}
