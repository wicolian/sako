import { describe, expect, it } from 'vitest'
import { getProviderCatalog } from '@/lib/providers/catalog'

describe('provider catalog', () => {
  it('marks campaign handoff destinations honestly', () => {
    const catalog = getProviderCatalog()
    const byId = new Map(catalog.map((provider) => [provider.id, provider]))

    expect(byId.get('hubspot')?.deliveryMode).toBe('direct_deploy')
    expect(byId.get('figma')?.deliveryMode).toBe('export_only')
    expect(byId.get('framer')?.deliveryMode).toBe('export_only')
    expect(byId.get('salesforce')?.deliveryMode).toBe('coming_soon')
  })

  it('does not mark coming-soon providers as live', () => {
    const catalog = getProviderCatalog()
    const comingSoon = catalog.filter((provider) => provider.surfaceStatus === 'coming_soon')

    expect(comingSoon.length).toBeGreaterThan(0)
    expect(comingSoon.every((provider) => provider.deliveryMode === 'coming_soon')).toBe(true)
  })
})
