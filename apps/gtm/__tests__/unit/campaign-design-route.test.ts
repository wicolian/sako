/**
 * Tests for GET and POST /api/campaigns/[id]/design
 *
 * Key invariants:
 * - POST generates via generateLandingPage(), persists render_html, sets editorMode=controlled
 * - GET backfills from campaign_assets HTML before falling back to sections/page_blocks
 * - Backfilled designs from campaign_assets with HTML have render_html set
 * - Backfilled designs from page_blocks only have render_html='' (regeneration recommended)
 * - mapWebsiteDesignRow includes the new render fields
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { NextRequest } from 'next/server'

vi.mock('@/lib/workspace', () => ({
  getWorkspaceIdWithFallback: vi.fn(() => 'ws-1'),
}))

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: vi.fn(),
}))

// ─────────────────────────────────────────────────────────
// mapWebsiteDesignRow – unit test (no mocks needed)
// ─────────────────────────────────────────────────────────

describe('mapWebsiteDesignRow', () => {
  it('maps render_html, render_manifest, and editor_mode from the DB row', async () => {
    const { mapWebsiteDesignRow } = await import('@/lib/campaigns/landing-design')

    const row = {
      id: 'd1',
      workspace_id: 'ws-1',
      name: 'Test Design',
      sections: [],
      global_styles: null,
      seo_meta: { title: 'T', description: 'D' },
      render_html: '<html><body>hello</body></html>',
      render_manifest: { isLegacyBackfill: false, claims: ['We are #1'] },
      editor_mode: 'controlled',
      status: 'draft',
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    }

    const design = mapWebsiteDesignRow(row)

    expect(design.renderHtml).toBe('<html><body>hello</body></html>')
    expect(design.renderManifest).toEqual({ isLegacyBackfill: false, claims: ['We are #1'] })
    expect(design.editorMode).toBe('controlled')
  })

  it('defaults to freeform and empty render fields when columns are absent (pre-migration rows)', async () => {
    const { mapWebsiteDesignRow } = await import('@/lib/campaigns/landing-design')

    const row = {
      id: 'd2',
      workspace_id: 'ws-1',
      name: 'Old Design',
      sections: [],
      global_styles: null,
      seo_meta: null,
      // render_html, render_manifest, editor_mode absent (pre-migration)
      status: 'draft',
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    }

    const design = mapWebsiteDesignRow(row)

    expect(design.renderHtml).toBe('')
    expect(design.renderManifest).toEqual({})
    expect(design.editorMode).toBe('freeform')
  })
})

// ─────────────────────────────────────────────────────────
// createWebsiteDesignFromGeneratedPage – editorMode + render fields
// ─────────────────────────────────────────────────────────

describe('createWebsiteDesignFromGeneratedPage', () => {
  it('sets editorMode=controlled and persists render_html from GeneratedPage.html', async () => {
    const { createWebsiteDesignFromGeneratedPage } = await import('@/lib/campaigns/landing-design')

    const page = {
      html: '<html><body><h1>Hello</h1></body></html>',
      sections: [{ type: 'hero', html: '<h1>Hello</h1>' }],
      websiteSections: [],
      globalStyles: {
        colorScheme: 'light' as const,
        primaryColor: '#6366f1',
        secondaryColor: '#8b5cf6',
        fontHeading: 'Inter',
        fontBody: 'Inter',
        borderRadius: 'medium' as const,
        buttonStyle: 'solid' as const,
      },
      seoMeta: { title: 'Hello', description: 'World' },
      designTokens: { primaryColor: '#6366f1', secondaryColor: '#8b5cf6', fontFamily: 'Inter' },
      claims: ['First-in-class solution'],
    }

    const design = createWebsiteDesignFromGeneratedPage({
      page,
      workspaceId: 'ws-1',
      campaign: { id: 'c1', name: 'Test Campaign' },
    })

    expect(design.editorMode).toBe('controlled')
    expect(design.renderHtml).toBe('<html><body><h1>Hello</h1></body></html>')
    expect(design.renderManifest.claims).toEqual(['First-in-class solution'])
    expect(design.renderManifest.isLegacyBackfill).toBe(false)
  })

  it('strips tailwind CDN script tags from render_html', async () => {
    const { createWebsiteDesignFromGeneratedPage } = await import('@/lib/campaigns/landing-design')

    const rawHtml = `<html><head><script src="https://cdn.tailwindcss.com"></script></head><body><h1>Hi</h1></body></html>`

    const page = {
      html: rawHtml,
      sections: [],
      websiteSections: [],
      globalStyles: {
        colorScheme: 'light' as const,
        primaryColor: '#000',
        fontHeading: 'Inter',
        fontBody: 'Inter',
        borderRadius: 'medium' as const,
        buttonStyle: 'solid' as const,
      },
      seoMeta: { title: 'T', description: 'D' },
      designTokens: { primaryColor: '#000', secondaryColor: '#000', fontFamily: 'Inter' },
      claims: [],
    }

    const design = createWebsiteDesignFromGeneratedPage({
      page,
      workspaceId: 'ws-1',
      campaign: { id: 'c1', name: 'Test' },
    })

    expect(design.renderHtml).not.toContain('cdn.tailwindcss.com')
    expect(design.renderHtml).toContain('<h1>Hi</h1>')
  })
})

// ─────────────────────────────────────────────────────────
// GET /api/campaigns/[id]/design – via route handler
// ─────────────────────────────────────────────────────────

describe('GET /api/campaigns/[id]/design', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('returns null design when campaign is not found (GET returns 200 with null)', async () => {
    const { createServiceClient } = await import('@/lib/supabase/service')

    ;(createServiceClient as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === 'campaigns') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
                })),
              })),
            })),
          }
        }
        // page_blocks (backfill path) — returns empty
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(() => Promise.resolve({ data: [], error: null })),
            })),
          })),
        }
      }),
    } as never)

    const { GET } = await import('@/app/api/campaigns/[id]/design/route')
    const response = await GET(
      new Request('http://localhost/api/campaigns/missing/design') as NextRequest,
      { params: Promise.resolve({ id: 'missing' }) },
    )
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.design).toBeNull()
  })

  it('returns the linked design with render_html when landing_design_id is set', async () => {
    const { createServiceClient } = await import('@/lib/supabase/service')

    const designRow = {
      id: 'design-1',
      workspace_id: 'ws-1',
      name: 'My Landing Page',
      sections: [],
      global_styles: null,
      seo_meta: { title: 'Test', description: '' },
      render_html: '<html><body>canonical</body></html>',
      render_manifest: { isLegacyBackfill: false },
      editor_mode: 'controlled',
      status: 'draft',
      created_at: '2026-03-12T00:00:00.000Z',
      updated_at: '2026-03-12T00:00:00.000Z',
    }

    ;(createServiceClient as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === 'campaigns') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn(() =>
                    Promise.resolve({
                      data: {
                        id: 'camp-1',
                        name: 'Test Campaign',
                        landing_design_id: 'design-1',
                      },
                      error: null,
                    }),
                  ),
                })),
              })),
            })),
          }
        }

        if (table === 'website_designs') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(() =>
                  Promise.resolve({ data: designRow, error: null }),
                ),
              })),
            })),
          }
        }

        return {}
      }),
    } as never)

    const { GET } = await import('@/app/api/campaigns/[id]/design/route')
    const response = await GET(
      new Request('http://localhost/api/campaigns/camp-1/design') as NextRequest,
      { params: Promise.resolve({ id: 'camp-1' }) },
    )
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.design.id).toBe('design-1')
    expect(data.design.renderHtml).toBe('<html><body>canonical</body></html>')
    expect(data.design.editorMode).toBe('controlled')
  })
})

// ─────────────────────────────────────────────────────────
// POST /api/campaigns/[id]/design
// ─────────────────────────────────────────────────────────

describe('POST /api/campaigns/[id]/design', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('generates a design and returns editorMode=controlled with render_html', async () => {
    const { createServiceClient } = await import('@/lib/supabase/service')

    const fakeDesign = {
      id: 'new-design-1',
      workspace_id: 'ws-1',
      name: 'Campaign Landing Page',
      sections: [],
      globalStyles: { colorScheme: 'light', primaryColor: '#000', fontHeading: 'Inter', fontBody: 'Inter', borderRadius: 'medium', buttonStyle: 'solid' },
      seoMeta: { title: 'Test', description: '' },
      renderHtml: '<html><body>generated</body></html>',
      renderManifest: { isLegacyBackfill: false, claims: [] },
      editorMode: 'controlled',
      status: 'draft',
      created_at: '2026-03-12T00:00:00.000Z',
      updated_at: '2026-03-12T00:00:00.000Z',
    }

    // Mock the landing-design lib
    vi.doMock('@/lib/campaigns/landing-design', () => ({
      fetchLinkedCampaignLandingDesign: vi.fn(),
      generateCampaignLandingDesign: vi.fn(() => Promise.resolve(fakeDesign)),
      MissingWebsiteDesignStorageError: class MissingWebsiteDesignStorageError extends Error {},
    }))

    ;(createServiceClient as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(() =>
                Promise.resolve({
                  data: { id: 'camp-3', name: 'Campaign', goal: 'Signups', audience: 'Devs', offer: 'Free', cta: 'Go' },
                  error: null,
                }),
              ),
            })),
          })),
        })),
      })),
    } as never)

    const { POST } = await import('@/app/api/campaigns/[id]/design/route')
    const response = await POST(
      new Request('http://localhost/api/campaigns/camp-3/design', { method: 'POST' }) as NextRequest,
      { params: Promise.resolve({ id: 'camp-3' }) },
    )
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data.design.editorMode).toBe('controlled')
    expect(data.design.renderHtml).toBe('<html><body>generated</body></html>')
  })

  it('returns 500 when generation throws an unexpected error', async () => {
    const { createServiceClient } = await import('@/lib/supabase/service')

    vi.doMock('@/lib/campaigns/landing-design', () => ({
      fetchLinkedCampaignLandingDesign: vi.fn(),
      generateCampaignLandingDesign: vi.fn(() => {
        throw new Error('Unexpected generation failure')
      }),
      MissingWebsiteDesignStorageError: class MissingWebsiteDesignStorageError extends Error {},
    }))

    ;(createServiceClient as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(() =>
                Promise.resolve({ data: { id: 'c4', name: 'X' }, error: null }),
              ),
            })),
          })),
        })),
      })),
    } as never)

    const { POST } = await import('@/app/api/campaigns/[id]/design/route')
    const response = await POST(
      new Request('http://localhost/api/campaigns/c4/design', { method: 'POST' }) as NextRequest,
      { params: Promise.resolve({ id: 'c4' }) },
    )
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toBe('Unexpected generation failure')
  })
})
