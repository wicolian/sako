import { createServiceClient } from '@/lib/supabase/service'
import { getPlan, normalizePlanId, type Plan, type PlanId } from '@/lib/billing/plans'

export type EntitlementFeature =
  | 'advancedModelPicker'
  | 'apiAccess'
  | 'assetExport'
  | 'customTemplates'
  | 'directDeploy'
  | 'prioritySupport'
  | 'sakoEscalation'
  | 'sso'
  | 'subdomainPublish'

export interface WorkspaceEntitlements {
  workspaceId: string
  planId: PlanId
  plan: Plan
  subscriptionStatus: string
  isActive: boolean
  features: Record<EntitlementFeature, boolean>
}

const ACTIVE_STATUSES = new Set(['active', 'trialing'])

export function getEntitlementsForPlan(
  rawPlanId: string | null | undefined,
  rawStatus: string | null | undefined = 'missing',
  workspaceId = ''
): WorkspaceEntitlements {
  const planId = normalizePlanId(rawPlanId)
  const plan = getPlan(planId)
  const subscriptionStatus = rawStatus ?? 'missing'
  const isActive = ACTIVE_STATUSES.has(subscriptionStatus)
  const isPaid = planId !== 'free'

  const features: Record<EntitlementFeature, boolean> = {
    advancedModelPicker: isActive && ['growth', 'enterprise'].includes(planId),
    apiAccess: isActive && isPaid,
    assetExport: isActive && isPaid,
    customTemplates: isActive && Boolean(plan.limits.customTemplates),
    directDeploy: isActive && ['team', 'growth', 'enterprise'].includes(planId),
    prioritySupport: isActive && Boolean(plan.limits.prioritySupport),
    sakoEscalation: isActive && Boolean(plan.limits.sakoEscalation),
    sso: isActive && Boolean(plan.limits.sso),
    subdomainPublish: isActive && ['growth', 'enterprise'].includes(planId),
  }

  return {
    workspaceId,
    planId,
    plan,
    subscriptionStatus,
    isActive,
    features,
  }
}

export async function resolveWorkspaceEntitlements(workspaceId: string): Promise<WorkspaceEntitlements> {
  const supabase = createServiceClient()
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('plan_id, status')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return getEntitlementsForPlan(subscription?.plan_id, subscription?.status, workspaceId)
}

export async function requireWorkspaceEntitlement(
  workspaceId: string,
  feature: EntitlementFeature,
  options?: {
    message?: string
  }
): Promise<
  | { ok: true; entitlements: WorkspaceEntitlements }
  | { ok: false; entitlements: WorkspaceEntitlements; message: string }
> {
  const entitlements = await resolveWorkspaceEntitlements(workspaceId)
  if (entitlements.features[feature]) {
    return { ok: true, entitlements }
  }

  return {
    ok: false,
    entitlements,
    message:
      options?.message ??
      `${feature} requires an active ${feature === 'sso' ? 'Enterprise' : 'paid'} plan.`,
  }
}
