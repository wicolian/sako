import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { NextRequest } from 'next/server'

const createServerSupabaseClient = vi.fn()
const getWorkspaceIdWithFallback = vi.fn(() => 'ws-1')
const smartFetch = vi.fn()
const isValidUrl = vi.fn(() => true)
const normalizeUrl = vi.fn((url: string) => url)
const parseHtml = vi.fn()
const extractDesignTokens = vi.fn()
const analyzeBrand = vi.fn()
const extractBrandNameQuick = vi.fn(() => 'Linear')
const brandAnalysisToBrandContext = vi.fn(() => ({ narrative: 'brand-context' }))
const extractClaims = vi.fn()
const getEvidenceSummary = vi.fn(() => ({ total: 0 }))
const researchAllClaims = vi.fn()
const autoLinkEvidence = vi.fn()
const getLinkingSummary = vi.fn(() => ({ supported: 0, weak: 0, unsupported: 0 }))
const calculateComplianceScore = vi.fn(() => ({ score: 100, grade: 'A' }))

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient,
}))

vi.mock('@/lib/workspace', () => ({
  getWorkspaceIdWithFallback,
}))

vi.mock('@/lib/import/url-fetcher', () => ({
  smartFetch,
  isValidUrl,
  normalizeUrl,
}))

vi.mock('@/lib/import/html-parser', () => ({
  parseHtml,
}))

vi.mock('@/lib/import/design-extractor', () => ({
  extractDesignTokens,
}))

vi.mock('@/lib/import/brand-extractor', () => ({
  analyzeBrand,
  extractBrandNameQuick,
  brandAnalysisToBrandContext,
}))

vi.mock('@/lib/import/claims-extractor', () => ({
  extractClaims,
}))

vi.mock('@/lib/import/evidence-researcher', () => ({
  researchAllClaims,
  getEvidenceSummary,
}))

vi.mock('@/lib/import/evidence-linker', () => ({
  autoLinkEvidence,
  getLinkingSummary,
  calculateComplianceScore,
}))

function createImportSupabaseMock(options?: { brandSaveError?: string }) {
  const brandUpsert = vi.fn(() => ({
    select: vi.fn(() => ({
      single: vi.fn().mockResolvedValue(
        options?.brandSaveError
          ? { data: null, error: { message: options.brandSaveError } }
          : { data: { id: 'brand-1' }, error: null }
      ),
    })),
  }))
  const brandMemoryUpsert = vi.fn().mockResolvedValue({ error: null })

  return {
    brandUpsert,
    brandMemoryUpsert,
    client: {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }),
      },
      from: vi.fn((table: string) => {
        if (table === 'workspace_settings') {
          return {
            upsert: vi.fn().mockResolvedValue({ error: null }),
          }
        }

        if (table === 'brands') {
          return {
            upsert: brandUpsert,
          }
        }

        if (table === 'brand_memory') {
          return {
            upsert: brandMemoryUpsert,
          }
        }

        if (table === 'claims' || table === 'evidence') {
          return {
            insert: vi.fn().mockResolvedValue({ error: null }),
          }
        }

        throw new Error(`Unexpected table ${table}`)
      }),
    },
  }
}

async function readSse(response: Response) {
  const raw = await response.text()
  return raw
    .split('\n\n')
    .filter((chunk) => chunk.startsWith('data: '))
    .map((chunk) => JSON.parse(chunk.slice(6)))
}

describe('import analyze route', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    smartFetch.mockResolvedValue({
      html: '<html><title>Linear</title></html>',
      url: 'https://linear.app',
    })

    parseHtml.mockReturnValue({
      sections: [{ id: 'section-1', type: 'hero', textContent: 'Linear powers product development teams.' }],
      textContent: 'Linear powers product development teams.',
      title: 'Linear',
      description: 'The system for product development',
      ogTags: {},
      sanitizedHtml: '<main>Linear</main>',
    })

    extractDesignTokens.mockReturnValue({
      colors: {
        primary: '#000000',
        secondary: '#222222',
        accent: '#444444',
        background: '#ffffff',
        text: '#111111',
      },
      typography: {
        fontFamily: 'Inter',
        fontHeading: 'Inter',
      },
      spacing: {
        scale: [8, 12, 16],
      },
    })

    analyzeBrand.mockResolvedValue({
      name: 'Linear',
      tagline: 'The system for product development',
      voice: {
        tone: 'Direct',
        formality: 'professional',
        formalityScore: 3,
        humorScore: 1,
        technicalDepthScore: 4,
        personality: ['technical', 'concise'],
      },
      audience: {
        type: 'Product teams',
        personas: ['PM'],
        painPoints: ['slow delivery'],
      },
      industry: 'SaaS',
      keyMessages: ['Ship faster'],
      valuePropositions: ['Ship better'],
      competitiveAdvantages: ['Fast issue tracking'],
      logoUrl: 'https://linear.app/logo.png',
      socialProof: {
        testimonials: ['We ship with more confidence.'],
        stats: ['15% faster delivery'],
        logos: ['Acme'],
      },
    })

    extractClaims.mockResolvedValue([])
    researchAllClaims.mockResolvedValue(new Map())
    autoLinkEvidence.mockResolvedValue([])
  })

  it('completes with a persisted brand id and schema-aligned brand fields', async () => {
    const supabase = createImportSupabaseMock()
    createServerSupabaseClient.mockResolvedValue(supabase.client)

    const { POST } = await import('@/app/api/import/analyze/route')
    const request = new Request('http://localhost/api/import/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://linear.app', confirmOwnership: true }),
    })

    const response = await POST(request as NextRequest)
    const events = await readSse(response)
    const complete = events.find((event) => event.event === 'complete') as
      | { event: 'complete'; data: { brandId: string } }
      | undefined

    expect(response.status).toBe(200)
    expect(complete).toBeDefined()
    if (!complete) {
      throw new Error('Expected complete import event')
    }
    expect(complete.data.brandId).toBe('brand-1')

    const firstBrandUpsertCall = supabase.brandUpsert.mock.calls.at(0)
    if (!firstBrandUpsertCall) {
      throw new Error('Expected brand upsert call')
    }
    const brandPayload = (firstBrandUpsertCall as unknown[])[0] as Record<string, unknown>
    expect(brandPayload.website_url).toBe('https://linear.app')
    expect(brandPayload.font_heading).toBe('Inter')
    expect(brandPayload.tone_attributes).toEqual(['technical', 'concise'])
    expect(brandPayload).not.toHaveProperty('heading_font')
    expect(brandPayload).not.toHaveProperty('tone_keywords')

    const completeData = complete.data as Record<string, unknown>
    expect(completeData.proofProfile).toMatchObject({
      recommendedStrategy: expect.any(String),
      candidates: expect.any(Array),
      gaps: expect.any(Array),
    })
  })

  it('persists a proof profile into brand memory sources', async () => {
    const supabase = createImportSupabaseMock()
    createServerSupabaseClient.mockResolvedValue(supabase.client)

    const { POST } = await import('@/app/api/import/analyze/route')
    const request = new Request('http://localhost/api/import/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://linear.app', confirmOwnership: true }),
    })

    const response = await POST(request as NextRequest)
    await readSse(response)

    const payload = supabase.brandMemoryUpsert.mock.calls.at(0)?.[0] as
      | { sources?: Array<Record<string, unknown>> }
      | undefined
    expect(payload?.sources?.[0]?.proofProfile).toMatchObject({
      recommendedStrategy: expect.any(String),
      candidates: expect.any(Array),
      gaps: expect.any(Array),
    })
  })

  it('emits an error event instead of a fake success when brand persistence fails', async () => {
    const supabase = createImportSupabaseMock({ brandSaveError: 'column does not exist' })
    createServerSupabaseClient.mockResolvedValue(supabase.client)

    const { POST } = await import('@/app/api/import/analyze/route')
    const request = new Request('http://localhost/api/import/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://linear.app', confirmOwnership: true }),
    })

    const response = await POST(request as NextRequest)
    const events = await readSse(response)

    expect(response.status).toBe(200)
    expect(events.some((event) => event.event === 'complete')).toBe(false)
    expect(events.at(-1)).toMatchObject({
      event: 'error',
      stage: 'finalizing',
    })
    expect(events.at(-1)?.error).toContain('could not save')
  })
})
