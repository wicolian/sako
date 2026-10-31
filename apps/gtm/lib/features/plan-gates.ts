import { getEntitlementsForPlan } from '@/lib/billing/entitlements'

export function canUseAdvancedModelPicker(planId?: string, subscriptionStatus?: string): boolean {
  return getEntitlementsForPlan(planId, subscriptionStatus ?? 'missing').features.advancedModelPicker
}
