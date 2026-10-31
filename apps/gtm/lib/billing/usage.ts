import { createServiceClient } from '@/lib/supabase/service'
import { getPlanLimits } from './plans'
import { Database } from '@/lib/supabase/types'

type SubscriptionRow = Database['public']['Tables']['subscriptions']['Row']
type CampaignRow = Database['public']['Tables']['campaigns']['Row']

export interface LimitCheckResult {
  allowed: boolean
  current: number
  limit: number
}

export async function checkLimit(
  workspaceId: string,
  limitType: 'campaigns' | 'apiCalls' | 'deployments' | 'publishes'
): Promise<LimitCheckResult> {
  const supabase = createServiceClient()

  // Get subscription
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('plan_id')
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  const planLimits = getPlanLimits(subscription?.plan_id || 'free')
  const limitKey =
    limitType === 'apiCalls'
      ? 'apiCalls'
      : limitType === 'deployments' || limitType === 'publishes'
        ? 'publishesPerMonth'
        : 'campaigns'
  const limitValue = planLimits[limitKey]

  if (limitValue === -1 || limitValue === 'unlimited') {
    return { allowed: true, current: 0, limit: -1 }
  }

  const limit = typeof limitValue === 'number' ? limitValue : 0

  // Get current usage for this period
  const now = new Date()
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .split('T')[0]

  if (limitType === 'campaigns') {
    // Count campaigns created this month
    const { count } = await supabase
      .from('campaigns')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .gte('created_at', periodStart)

    return {
      allowed: (count || 0) < limit,
      current: count || 0,
      limit,
    }
  } else {
    // Get from usage_metrics
    const metricType = limitType === 'apiCalls' ? 'api_calls' : 'deployments'
    const { data: usage } = await supabase
      .from('usage_metrics')
      .select('count')
      .eq('workspace_id', workspaceId)
      .eq('metric_type', metricType)
      .eq('period_start', periodStart)
      .maybeSingle()

    const current = usage?.count || 0

    return {
      allowed: current < limit,
      current,
      limit,
    }
  }
}

export async function incrementUsage(
  workspaceId: string,
  metricType: 'api_calls' | 'deployments'
): Promise<void> {
  const supabase = createServiceClient()
  const now = new Date()
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .split('T')[0]
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    .toISOString()
    .split('T')[0]

  await supabase.rpc('increment_usage_metric', {
    p_workspace_id: workspaceId,
    p_metric_type: metricType,
    p_period_start: periodStart,
    p_period_end: periodEnd,
  })
}

export async function getUsageSummary(workspaceId: string): Promise<{
  campaigns: { current: number; limit: number }
  apiCalls: { current: number; limit: number }
  publishes: { current: number; limit: number }
}> {
  const [campaigns, apiCalls, publishes] = await Promise.all([
    checkLimit(workspaceId, 'campaigns'),
    checkLimit(workspaceId, 'apiCalls'),
    checkLimit(workspaceId, 'publishes'),
  ])

  return {
    campaigns: { current: campaigns.current, limit: campaigns.limit },
    apiCalls: { current: apiCalls.current, limit: apiCalls.limit },
    publishes: { current: publishes.current, limit: publishes.limit },
  }
}
