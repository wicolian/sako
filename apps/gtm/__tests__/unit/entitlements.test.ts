import { describe, expect, it } from 'vitest'
import { getEntitlementsForPlan } from '@/lib/billing/entitlements'
import { canUseFeature, normalizePlanId } from '@/lib/billing/plans'

describe('billing entitlements', () => {
  it('keeps free as a real free tier', () => {
    expect(normalizePlanId('free')).toBe('free')
    expect(canUseFeature('free', 'sakoEscalation')).toBe(false)
  })

  it('normalizes legacy aliases into canonical paid plans', () => {
    expect(normalizePlanId('starter')).toBe('solo')
    expect(normalizePlanId('pro')).toBe('team')
    expect(normalizePlanId('max')).toBe('growth')
    expect(normalizePlanId('ops')).toBe('growth')
  })

  it('disables premium entitlements for inactive subscriptions', () => {
    const entitlements = getEntitlementsForPlan('growth', 'canceled', 'ws-1')
    expect(entitlements.planId).toBe('growth')
    expect(entitlements.features.sakoEscalation).toBe(false)
    expect(entitlements.features.directDeploy).toBe(false)
    expect(entitlements.features.subdomainPublish).toBe(false)
  })

  it('enables the expected premium features on growth and enterprise', () => {
    const growth = getEntitlementsForPlan('growth', 'active', 'ws-1')
    expect(growth.features.sakoEscalation).toBe(true)
    expect(growth.features.directDeploy).toBe(true)
    expect(growth.features.subdomainPublish).toBe(true)
    expect(growth.features.sso).toBe(false)

    const enterprise = getEntitlementsForPlan('enterprise', 'trialing', 'ws-1')
    expect(enterprise.features.sso).toBe(true)
    expect(enterprise.features.customTemplates).toBe(true)
    expect(enterprise.features.prioritySupport).toBe(true)
  })
})
