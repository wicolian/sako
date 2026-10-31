import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { NextRequest } from 'next/server'

vi.mock('@/lib/workspace', () => ({
  getWorkspaceIdWithFallback: vi.fn(() => 'ws-1'),
}))

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: vi.fn(),
}))

describe('kit route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns a normalized launch kit payload', async () => {
    const { createServiceClient } = await import('@/lib/supabase/service')
    const { GET } = await import('@/app/api/kit/[id]/route')

    ;(createServiceClient as unknown as { mockReturnValue: (value: unknown) => void }).mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(() =>
                Promise.resolve({
                  data: {
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
                  },
                  error: null,
                }),
              ),
            })),
          })),
        })),
      })),
    } as never)

    const response = await GET(
      new Request('http://localhost/api/kit/kit-1') as NextRequest,
      { params: Promise.resolve({ id: 'kit-1' }) },
    )
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.kit.campaignId).toBe('camp-1')
    expect(data.kit.createdAt).toBe('2026-03-12T00:00:00.000Z')
  })

  it('returns a storage error when the launch_kits table is unavailable', async () => {
    const { createServiceClient } = await import('@/lib/supabase/service')
    const { GET } = await import('@/app/api/kit/[id]/route')

    ;(createServiceClient as unknown as { mockReturnValue: (value: unknown) => void }).mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(() =>
                Promise.resolve({
                  data: null,
                  error: {
                    message: "Could not find the table 'public.launch_kits' in the schema cache",
                  },
                }),
              ),
            })),
          })),
        })),
      })),
    } as never)

    const response = await GET(
      new Request('http://localhost/api/kit/kit-1') as NextRequest,
      { params: Promise.resolve({ id: 'kit-1' }) },
    )
    const data = await response.json()

    expect(response.status).toBe(503)
    expect(data.error).toContain('Launch kit storage is unavailable')
  })
})
