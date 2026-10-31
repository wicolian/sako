import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { NextRequest } from 'next/server'

vi.mock('@/lib/workspace', () => ({
  getWorkspaceIdWithFallback: vi.fn(() => 'ws-1'),
  handleWorkspaceError: vi.fn(() => new Response(JSON.stringify({ error: 'workspace error' }), { status: 500 })),
}))

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: vi.fn(),
}))

describe('campaign create route brand linking', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('stores brand_id when creating a campaign from an imported brand', async () => {
    const inserted: Array<Record<string, unknown>> = []
    const { createServiceClient } = await import('@/lib/supabase/service')
    const { POST } = await import('@/app/api/campaigns/route')

    ;(createServiceClient as unknown as { mockReturnValue: (value: unknown) => void }).mockReturnValue({
      from: vi.fn(() => ({
        insert: vi.fn((payload: Record<string, unknown>) => {
          inserted.push(payload)
          return {
            select: () => ({
              single: () =>
                Promise.resolve({
                  data: {
                    id: 'camp-1',
                    ...payload,
                  },
                  error: null,
                }),
            }),
          }
        }),
      })),
    } as never)

    const request = new Request('http://localhost/api/campaigns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Imported campaign',
        goal: 'Turn visits into demos',
        audience: 'PM leaders',
        offer: 'Demo',
        cta: 'Book demo',
        brandId: '550e8400-e29b-41d4-a716-446655440000',
      }),
    })

    const response = await POST(request as NextRequest)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(inserted[0]?.brand_id).toBe('550e8400-e29b-41d4-a716-446655440000')
    expect((inserted[0]?.constraints as Record<string, unknown>)?.linked_brand_id).toBe('550e8400-e29b-41d4-a716-446655440000')
    expect(data.id).toBe('camp-1')
  })

  it('falls back to constraints-linked brand storage when campaigns.brand_id is missing from schema cache', async () => {
    const inserted: Array<Record<string, unknown>> = []
    let attempt = 0
    const { createServiceClient } = await import('@/lib/supabase/service')
    const { POST } = await import('@/app/api/campaigns/route')

    ;(createServiceClient as unknown as { mockReturnValue: (value: unknown) => void }).mockReturnValue({
      from: vi.fn(() => ({
        insert: vi.fn((payload: Record<string, unknown>) => {
          inserted.push(payload)
          attempt += 1
          return {
            select: () => ({
              single: () =>
                Promise.resolve(
                  attempt === 1
                    ? {
                        data: null,
                        error: {
                          message: "Could not find the 'brand_id' column of 'campaigns' in the schema cache",
                        },
                      }
                    : {
                        data: {
                          id: 'camp-compat',
                          ...payload,
                        },
                        error: null,
                      }
                ),
            }),
          }
        }),
      })),
    } as never)

    const request = new Request('http://localhost/api/campaigns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Imported campaign',
        brandId: '550e8400-e29b-41d4-a716-446655440000',
        constraints: { flow: 'url_import' },
      }),
    })

    const response = await POST(request as NextRequest)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(inserted).toHaveLength(2)
    expect(inserted[0]?.brand_id).toBe('550e8400-e29b-41d4-a716-446655440000')
    expect(inserted[1]?.brand_id).toBeUndefined()
    expect((inserted[1]?.constraints as Record<string, unknown>)?.linked_brand_id).toBe('550e8400-e29b-41d4-a716-446655440000')
    expect(data.id).toBe('camp-compat')
  })

  it('rejects an invalid brand id instead of passing bad data to Supabase', async () => {
    const { createServiceClient } = await import('@/lib/supabase/service')
    const { POST } = await import('@/app/api/campaigns/route')

    ;(createServiceClient as unknown as { mockReturnValue: (value: unknown) => void }).mockReturnValue({
      from: vi.fn(),
    } as never)

    const request = new Request('http://localhost/api/campaigns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Imported campaign',
        brandId: 'not-a-uuid',
      }),
    })

    const response = await POST(request as NextRequest)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toContain('Invalid')
  })
})
