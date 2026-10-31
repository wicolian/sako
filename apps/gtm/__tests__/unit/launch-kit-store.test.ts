import { describe, expect, it } from 'vitest'
import { buildLaunchKitFromCampaignGeneration, mapLaunchKitRecord } from '@/lib/kit/launch-kit-store'
import type { AssetDocument } from '@/lib/assets/asset-document'

describe('launch kit store helpers', () => {
  it('builds a launch kit linked to a campaign and summarizes compliance', () => {
    const assetDocuments = [
      {
        id: 'doc-1',
        workspaceId: 'ws-1',
        brandId: 'brand-1',
        campaignId: 'camp-1',
        assetType: 'landing_page',
        title: 'Landing',
        content: {},
        htmlContent: null,
        designTokens: null,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        claims: [
          { id: 'c-1', text: 'Verified claim', status: 'verified', riskScore: 5 },
          { id: 'c-2', text: 'Blocked claim', status: 'pending', riskScore: 91 },
          { id: 'c-3', text: 'Needs review', status: 'pending', riskScore: 42 },
        ],
        complianceStatus: 'warning',
        version: 1,
      },
    ] as unknown as AssetDocument[]

    const kit = buildLaunchKitFromCampaignGeneration({
      kitId: 'kit-1',
      campaignId: 'camp-1',
      workspaceId: 'ws-1',
      brief: {
        launchType: 'campaign',
        audience: 'Operators',
        offer: 'Pipeline acceleration',
        cta: 'Book demo',
        constraints: { mustInclude: [], mustAvoid: [] },
        brandId: 'brand-1',
      },
      assets: {
        social: {
          posts: [],
        },
      },
      assetDocuments,
    })

    expect(kit.campaignId).toBe('camp-1')
    expect(kit.compliance).toMatchObject({
      totalClaims: 3,
      approved: 1,
      blocked: 1,
      needsReview: 1,
    })
  })

  it('maps a stored launch kit row into the public launch kit shape', () => {
    const kit = mapLaunchKitRecord({
      id: 'kit-1',
      workspace_id: 'ws-1',
      campaign_id: 'camp-1',
      brand_id: 'brand-1',
      brief: {
        launchType: 'campaign',
        audience: 'Operators',
        offer: 'Pipeline acceleration',
        cta: 'Book demo',
        constraints: { mustInclude: [], mustAvoid: [] },
        brandId: 'brand-1',
      },
      status: 'review',
      assets: {
        landingPage: null,
        ads: [],
        emails: null,
        socialPosts: [],
        deck: null,
      },
      compliance: {
        totalClaims: 0,
        approved: 0,
        needsReview: 0,
        blocked: 0,
        averageRiskScore: 0,
      },
      angles: [],
      created_at: '2026-03-12T00:00:00.000Z',
      updated_at: '2026-03-12T00:05:00.000Z',
      exported_at: null,
    })

    expect(kit.campaignId).toBe('camp-1')
    expect(kit.createdAt).toBeInstanceOf(Date)
    expect(kit.updatedAt).toBeInstanceOf(Date)
  })
})
