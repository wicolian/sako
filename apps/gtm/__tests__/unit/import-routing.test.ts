import { describe, expect, it } from 'vitest'

import { getBrandProfileHref, getImportedCampaignHref } from '@/lib/import/import-routing'

describe('import routing helpers', () => {
  it('never builds a brand profile route for a missing brand id', () => {
    expect(getBrandProfileHref(null)).toBeNull()
    expect(getBrandProfileHref(undefined)).toBeNull()
  })

  it('builds the imported campaign route only when a brand is persisted', () => {
    expect(getImportedCampaignHref(null, 'https://linear.app')).toBeNull()
    expect(getImportedCampaignHref('brand-1', 'https://linear.app')).toBe(
      '/campaigns/new?imported=1&brand=brand-1&sourceUrl=https%3A%2F%2Flinear.app'
    )
  })
})
