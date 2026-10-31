import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { NextRequest } from 'next/server'

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn(),
}))

type AnalyticsEvent = {
  workspace_id: string
  campaign_id: string | null
  asset_id: string | null
  claim_id: string | null
  event_type: string
  value: number | null
  created_at: string
}

function createThenableBuilder<T>(resolver: () => { data: T; error: null }) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    order: vi.fn(() => builder),
    not: vi.fn(() => builder),
    in: vi.fn(() => Promise.resolve(resolver())),
    single: vi.fn(() => Promise.resolve(resolver())),
    then: (resolve: (value: { data: T; error: null }) => unknown) => Promise.resolve(resolve(resolver())),
  }

  return builder
}

function createAnalyticsSupabaseMock(fixtures: {
  membershipWorkspaceId?: string
  events: AnalyticsEvent[]
  claims: Array<{ id: string; text: string; status: string }>
  assets: Array<{ id: string; asset_type: string; format: string }>
}) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }),
    },
    from: vi.fn((table: string) => {
      if (table === 'workspace_members') {
        return createThenableBuilder(() => ({
          data: { workspace_id: fixtures.membershipWorkspaceId ?? 'ws-1' },
          error: null,
        }))
      }

      if (table === 'analytics_events') {
        const filters: Record<string, string> = {}
        let requireClaimId = false
        let requireAssetId = false
        let startDate = ''

        const builder = {
          select: vi.fn(() => builder),
          eq: vi.fn((field: string, value: string) => {
            filters[field] = value
            return builder
          }),
          gte: vi.fn((field: string, value: string) => {
            if (field === 'created_at') startDate = value
            return builder
          }),
          order: vi.fn(() => builder),
          not: vi.fn((field: string, operator: string, value: null) => {
            if (operator === 'is' && value === null && field === 'claim_id') requireClaimId = true
            if (operator === 'is' && value === null && field === 'asset_id') requireAssetId = true
            return builder
          }),
          then: (resolve: (value: { data: AnalyticsEvent[]; error: null }) => unknown) => {
            const data = fixtures.events.filter((event) => {
              if (filters.workspace_id && event.workspace_id !== filters.workspace_id) return false
              if (filters.campaign_id && event.campaign_id !== filters.campaign_id) return false
              if (filters.asset_id && event.asset_id !== filters.asset_id) return false
              if (startDate && event.created_at < startDate) return false
              if (requireClaimId && !event.claim_id) return false
              if (requireAssetId && !event.asset_id) return false
              return true
            })

            return Promise.resolve(resolve({ data, error: null }))
          },
        }

        return builder
      }

      if (table === 'claims') {
        return {
          select: vi.fn(() => ({
            in: vi.fn((_field: string, ids: string[]) =>
              Promise.resolve({
                data: fixtures.claims.filter((claim) => ids.includes(claim.id)),
                error: null,
              })
            ),
          })),
        }
      }

      if (table === 'campaign_assets') {
        return {
          select: vi.fn(() => ({
            in: vi.fn((_field: string, ids: string[]) =>
              Promise.resolve({
                data: fixtures.assets.filter((asset) => ids.includes(asset.id)),
                error: null,
              })
            ),
          })),
        }
      }

      return createThenableBuilder(() => ({ data: [] as never[], error: null }))
    }),
  }
}

describe('analytics route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns metrics from real analytics events, claims, and assets', async () => {
    const { createServerSupabaseClient } = await import('@/lib/supabase/server')
    const { GET } = await import('@/app/api/analytics/route')

    const now = new Date().toISOString()
    ;(createServerSupabaseClient as unknown as { mockResolvedValue: (value: unknown) => void }).mockResolvedValue(
      createAnalyticsSupabaseMock({
        events: [
          { workspace_id: 'ws-1', campaign_id: 'camp-1', asset_id: 'asset-1', claim_id: 'claim-1', event_type: 'impression', value: 1, created_at: now },
          { workspace_id: 'ws-1', campaign_id: 'camp-1', asset_id: 'asset-1', claim_id: 'claim-1', event_type: 'click', value: 1, created_at: now },
          { workspace_id: 'ws-1', campaign_id: 'camp-1', asset_id: 'asset-1', claim_id: 'claim-1', event_type: 'conversion', value: 250, created_at: now },
          { workspace_id: 'ws-1', campaign_id: 'camp-1', asset_id: null, claim_id: 'claim-1', event_type: 'claim_view', value: 1, created_at: now },
        ],
        claims: [{ id: 'claim-1', text: 'Backed by source evidence', status: 'approved' }],
        assets: [{ id: 'asset-1', asset_type: 'landing-page', format: 'desktop' }],
      }) as never
    )

    const request = new Request('http://localhost/api/analytics?campaignId=camp-1&period=30d')
    const response = await GET(request as NextRequest)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.metrics).toMatchObject({
      impressions: 1,
      clicks: 1,
      conversions: 1,
      claimViews: 1,
      ctr: 100,
      conversionRate: 100,
      revenue: 250,
      totalEvents: 4,
    })
    expect(data.claimAnalytics[0]).toMatchObject({
      claimId: 'claim-1',
      text: 'Backed by source evidence',
      status: 'approved',
      impressions: 2,
      clicks: 1,
      conversions: 1,
      ctr: 50,
    })
    expect(data.assetAnalytics[0]).toMatchObject({
      assetId: 'asset-1',
      type: 'landing-page',
      format: 'desktop',
      impressions: 1,
      clicks: 1,
      conversions: 1,
      ctr: 100,
    })
    expect(data.timeSeries).toHaveLength(30)
  })
})
