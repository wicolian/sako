import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { NextRequest } from 'next/server'

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn(),
}))

vi.mock('@/lib/claims/claim-lineage', () => ({
  listCampaignClaims: vi.fn(),
  linkClaimToCampaign: vi.fn(),
}))

function createServerSupabaseMock(workspaceId = 'ws-1') {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }),
    },
    from: vi.fn((table: string) => {
      if (table === 'workspace_members') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({ data: { workspace_id: workspaceId } }),
            })),
          })),
        }
      }

      throw new Error(`Unexpected table ${table}`)
    }),
  }
}

describe('campaign claim lineage API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns campaign-linked claims and real status aggregates', async () => {
    const { createServerSupabaseClient } = await import('@/lib/supabase/server')
    const { listCampaignClaims } = await import('@/lib/claims/claim-lineage')
    const { GET } = await import('@/app/api/claims/route')

    ;(createServerSupabaseClient as unknown as { mockResolvedValue: (value: unknown) => void }).mockResolvedValue(
      createServerSupabaseMock() as never
    )
    ;(listCampaignClaims as unknown as { mockResolvedValue: (value: unknown) => void }).mockResolvedValue([
      { id: 'claim-1', text: 'Approved claim', status: 'approved', riskScore: 15 },
      { id: 'claim-2', text: 'Needs proof claim', status: 'needs_proof', riskScore: 55 },
      { id: 'claim-3', text: 'Blocked claim', status: 'blocked', riskScore: 92 },
    ])

    const request = new Request('http://localhost/api/claims?campaign_id=camp-1')
    const response = await GET(request as NextRequest)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.claims).toHaveLength(3)
    expect(data.stats).toMatchObject({
      total: 3,
      approved: 1,
      needsProof: 1,
      blocked: 1,
      draft: 0,
      readyReview: 0,
      avgRisk: 54,
    })
    expect(listCampaignClaims).toHaveBeenCalledWith('ws-1', 'camp-1')
  })
})
