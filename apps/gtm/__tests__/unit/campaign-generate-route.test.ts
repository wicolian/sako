import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { NextRequest } from 'next/server'

vi.mock('@/lib/workspace', () => ({
  getWorkspaceIdWithFallback: vi.fn(() => 'ws-1'),
  handleWorkspaceError: vi.fn(() => new Response(JSON.stringify({ error: 'workspace error' }), { status: 500 })),
}))

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: vi.fn(),
}))

describe('campaign generate route brand requirements', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects imported campaigns that lost their brand link', async () => {
    const { createServiceClient } = await import('@/lib/supabase/service')
    const { POST } = await import('@/app/api/campaigns/[id]/generate/route')

    ;(createServiceClient as unknown as { mockReturnValue: (value: unknown) => void }).mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: 'camp-1',
                  workspace_id: 'ws-1',
                  brand_id: null,
                  constraints: {
                    flow: 'url_import',
                  },
                },
                error: null,
              }),
            })),
          })),
        })),
      })),
    } as never)

    const request = new Request('http://localhost/api/campaigns/camp-1/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        assetTypes: ['landing-page'],
      }),
    })

    const response = await POST(request as NextRequest, {
      params: Promise.resolve({ id: 'camp-1' }),
    })
    const data = await response.json()

    expect(response.status).toBe(409)
    expect(data.error).toContain('saved brand link')
  })
})
