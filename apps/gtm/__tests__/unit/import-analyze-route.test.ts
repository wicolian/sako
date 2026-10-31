import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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
const isTavilyReachable = vi.fn()
const autoLinkEvidence = vi.fn()
const getLinkingSummary = vi.fn(() => ({ supported: 0, weak: 0, unsupported: 0 }))
const calculateComplianceScore = vi.fn(() => ({ score: 100, grade: 'A' }))
const extractCanonicalDomain = vi.fn((inputUrl: string) => {
  const url = new URL(inputUrl)
  return url.hostname.replace(/^www\./, '')
})
const fetchBrandfetchMetadata = vi.fn()

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
  isTavilyReachable,
}))

vi.mock('@/lib/import/evidence-linker', () => ({
  autoLinkEvidence,
  getLinkingSummary,
  calculateComplianceScore,
}))

vi.mock('@/lib/import/brandfetch', () => ({
  extractCanonicalDomain,
  fetchBrandfetchMetadata,
}))

function createImportSupabaseMock(options?: {
  brandSaveError?: string
  brandMemoryError?: string
  existingBrands?: Array<{ id: string; website_url: string | null; is_default: boolean | null }>
}) {
  const workspaceSettingsUpsert = vi.fn().mockResolvedValue({ error: null })
  const brandMemoryUpsert = vi.fn().mockResolvedValue({
    error: options?.brandMemoryError ? { message: options.brandMemoryError } : null,
  })
  const claimsInsert = vi.fn().mockResolvedValue({ error: null })
  const evidenceInsert = vi.fn().mockResolvedValue({ error: null })

  const existingBrands = options?.existingBrands ?? []
  const brandSelectEq = vi.fn().mockResolvedValue({ data: existingBrands, error: null })
  const brandSelect = vi.fn(() => ({
    eq: brandSelectEq,
  }))

  const brandUpdateSingle = vi.fn().mockResolvedValue(
    options?.brandSaveError
      ? { data: null, error: { message: options.brandSaveError } }
      : { data: { id: existingBrands[0]?.id ?? 'brand-existing' }, error: null }
  )
  const brandUpdateSelect = vi.fn(() => ({
    single: brandUpdateSingle,
  }))
  const brandUpdateEq = vi.fn(() => ({
    select: brandUpdateSelect,
  }))
  const brandUpdate = vi.fn((payload: Record<string, unknown>) => {
    return {
      eq: brandUpdateEq,
      __payload: payload,
    }
  })

  const brandInsertSingle = vi.fn().mockResolvedValue(
    options?.brandSaveError
      ? { data: null, error: { message: options.brandSaveError } }
      : { data: { id: 'brand-1' }, error: null }
  )
  const brandInsertSelect = vi.fn(() => ({
    single: brandInsertSingle,
  }))
  const brandInsert = vi.fn((payload: Record<string, unknown>) => {
    return {
      select: brandInsertSelect,
      __payload: payload,
    }
  })

  return {
    workspaceSettingsUpsert,
    brandSelect,
    brandSelectEq,
    brandUpdate,
    brandUpdateEq,
    brandUpdateSelect,
    brandUpdateSingle,
    brandInsert,
    brandInsertSelect,
    brandInsertSingle,
    brandMemoryUpsert,
    claimsInsert,
    evidenceInsert,
    client: {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }),
      },
      from: vi.fn((table: string) => {
        if (table === 'workspace_settings') {
          return {
            upsert: workspaceSettingsUpsert,
          }
        }

        if (table === 'brands') {
          return {
            select: brandSelect,
            update: brandUpdate,
            insert: brandInsert,
          }
        }

        if (table === 'brand_memory') {
          return {
            upsert: brandMemoryUpsert,
          }
        }

        if (table === 'claims') {
          return {
            insert: claimsInsert,
          }
        }

        if (table === 'evidence') {
          return {
            insert: evidenceInsert,
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
    .map((chunk) => JSON.parse(chunk.slice(6)) as Record<string, unknown>)
}

async function executeImport(url = 'https://linear.app') {
  const { POST } = await import('@/app/api/import/analyze/route')
  const request = new Request('http://localhost/api/import/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, confirmOwnership: true }),
  })

  return POST(request as NextRequest)
}

describe('import analyze route', () => {
  const originalTavilyApiKey = process.env.TAVILY_API_KEY

  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.TAVILY_API_KEY

    smartFetch.mockResolvedValue({
      html: '<html><title>Linear</title></html>',
      url: 'https://linear.app',
    })

    parseHtml.mockReturnValue({
      sections: [{ id: 'section-1', type: 'hero', html: '<section>Hero</section>', textContent: 'Linear powers product development teams.' }],
      textContent: 'Linear powers product development teams.',
      title: 'Linear',
      description: 'The system for product development',
      ogTags: {},
      assets: {
        images: [],
        fonts: [],
        icons: [],
        stylesheets: [],
      },
      sanitizedHtml: '<main>Linear</main>',
    })

    extractDesignTokens.mockReturnValue({
      colors: {
        primary: '#000000',
        secondary: '#222222',
        accent: '#444444',
        background: '#ffffff',
        text: '#111111',
        allColors: ['#000000', '#222222', '#444444'],
        extractedFromPage: true,
      },
      typography: {
        fontFamily: 'Inter',
        fontHeading: 'Inter',
        fontSizes: ['16px'],
        fontWeights: ['400', '600'],
        lineHeights: ['1.5'],
        extractedFromPage: true,
      },
      spacing: {
        unit: 8,
        scale: [8, 12, 16],
      },
      corners: 'rounded',
      shadows: 'subtle',
      layout: {
        maxWidth: '1200px',
        containerPadding: '24px',
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

    fetchBrandfetchMetadata.mockResolvedValue(null)
    extractClaims.mockResolvedValue([])
    researchAllClaims.mockResolvedValue(new Map())
    isTavilyReachable.mockResolvedValue(true)
    autoLinkEvidence.mockResolvedValue([])
  })

  afterEach(() => {
    if (originalTavilyApiKey) {
      process.env.TAVILY_API_KEY = originalTavilyApiKey
    } else {
      delete process.env.TAVILY_API_KEY
    }
  })

  it('creates the first imported brand as the workspace default and prefers Brandfetch metadata', async () => {
    const supabase = createImportSupabaseMock()
    createServerSupabaseClient.mockResolvedValue(supabase.client)
    fetchBrandfetchMetadata.mockResolvedValue({
      source: 'brandfetch',
      domain: 'linear.app',
      websiteUrl: 'https://linear.app',
      name: 'Linear',
      description: 'Plan and build products faster.',
      longDescription: 'Linear helps product teams plan, track, and ship.',
      logoPrimaryUrl: 'https://cdn.brandfetch.io/linear/logo.svg',
      logoPrimaryDarkUrl: 'https://cdn.brandfetch.io/linear/logo-dark.svg',
      logoIconUrl: 'https://cdn.brandfetch.io/linear/icon.svg',
      faviconUrl: 'https://cdn.brandfetch.io/linear/favicon.png',
      primaryColor: '#5E6AD2',
      secondaryColor: '#1F1F28',
      accentColor: '#A4AEFF',
      palette: ['#5E6AD2', '#1F1F28', '#A4AEFF'],
      fontFamily: 'Inter',
      fontHeading: 'Circular',
      socialLinks: { linkedin: 'https://linkedin.com/company/linear' },
      qualityScore: 0.92,
      raw: {},
    })

    const response = await executeImport()
    const events = await readSse(response)
    const complete = events.find((event) => event.event === 'complete')

    expect(response.status).toBe(200)
    expect(complete).toBeDefined()
    expect(complete?.data).toMatchObject({
      brandId: 'brand-1',
      metadataSource: 'brandfetch',
      evidenceStatus: 'skipped',
    })

    expect(supabase.brandInsert).toHaveBeenCalledTimes(1)
    expect(supabase.brandUpdate).not.toHaveBeenCalled()

    const brandPayload = supabase.brandInsert.mock.calls[0]?.[0] as Record<string, unknown>
    expect(brandPayload.is_default).toBe(true)
    expect(brandPayload.website_url).toBe('https://linear.app')
    expect(brandPayload.logo_primary_url).toBe('https://cdn.brandfetch.io/linear/logo.svg')
    expect(brandPayload.logo_icon_url).toBe('https://cdn.brandfetch.io/linear/icon.svg')
    expect(brandPayload.primary_color).toBe('#5E6AD2')
    expect(brandPayload.font_heading).toBe('Circular')
    expect(brandPayload.social_links).toEqual({ linkedin: 'https://linkedin.com/company/linear' })
  })

  it('updates the existing same-domain brand instead of inserting a duplicate', async () => {
    const supabase = createImportSupabaseMock({
      existingBrands: [
        { id: 'brand-existing', website_url: 'https://www.linear.app', is_default: true },
      ],
    })
    createServerSupabaseClient.mockResolvedValue(supabase.client)

    const response = await executeImport()
    const events = await readSse(response)
    const complete = events.find((event) => event.event === 'complete')

    expect(response.status).toBe(200)
    expect(complete?.data).toMatchObject({ brandId: 'brand-existing' })
    expect(supabase.brandUpdate).toHaveBeenCalledTimes(1)
    expect(supabase.brandInsert).not.toHaveBeenCalled()

    const brandPayload = supabase.brandUpdate.mock.calls[0]?.[0] as Record<string, unknown>
    expect(brandPayload.website_url).toBe('https://linear.app')
    expect(brandPayload.tone_attributes).toEqual(['technical', 'concise'])
  })

  it('creates a side brand when a different domain is imported into a workspace with a default brand', async () => {
    const supabase = createImportSupabaseMock({
      existingBrands: [
        { id: 'brand-default', website_url: 'https://acme.com', is_default: true },
      ],
    })
    createServerSupabaseClient.mockResolvedValue(supabase.client)

    const response = await executeImport('https://linear.app')
    await readSse(response)

    expect(supabase.brandInsert).toHaveBeenCalledTimes(1)
    const brandPayload = supabase.brandInsert.mock.calls[0]?.[0] as Record<string, unknown>
    expect(brandPayload.is_default).toBe(false)
  })

  it('falls back to html/ai metadata when Brandfetch is unavailable', async () => {
    const supabase = createImportSupabaseMock()
    createServerSupabaseClient.mockResolvedValue(supabase.client)
    fetchBrandfetchMetadata.mockResolvedValue(null)

    const response = await executeImport()
    const events = await readSse(response)
    const complete = events.find((event) => event.event === 'complete')

    expect(complete?.data).toMatchObject({
      metadataSource: 'html_ai',
    })

    const brandPayload = supabase.brandInsert.mock.calls[0]?.[0] as Record<string, unknown>
    expect(brandPayload.logo_primary_url).toBe('https://linear.app/logo.png')
    expect(brandPayload.website_url).toBe('https://linear.app')
  })

  it('persists proof profile and Brandfetch provenance into brand memory', async () => {
    const supabase = createImportSupabaseMock()
    createServerSupabaseClient.mockResolvedValue(supabase.client)
    fetchBrandfetchMetadata.mockResolvedValue({
      source: 'brandfetch',
      domain: 'linear.app',
      websiteUrl: 'https://linear.app',
      name: 'Linear',
      description: 'Plan and build products faster.',
      palette: ['#5E6AD2'],
      socialLinks: {},
      qualityScore: 0.75,
      raw: {},
    })

    const response = await executeImport()
    await readSse(response)

    const payload = supabase.brandMemoryUpsert.mock.calls[0]?.[0] as
      | { sources?: Array<Record<string, unknown>>; logo_urls?: string[] }
      | undefined

    expect(payload?.logo_urls).toContain('https://linear.app/logo.png')
    expect(payload?.sources?.[0]?.metadataSource).toBe('brandfetch')
    expect(payload?.sources?.[0]?.proofProfile).toMatchObject({
      recommendedStrategy: expect.any(String),
      candidates: expect.any(Array),
      gaps: expect.any(Array),
    })
  })

  it('still completes when brand_memory is missing from the database schema cache', async () => {
    const supabase = createImportSupabaseMock({
      brandMemoryError: "Could not find the table 'public.brand_memory' in the schema cache",
    })
    createServerSupabaseClient.mockResolvedValue(supabase.client)

    const response = await executeImport()
    const events = await readSse(response)
    const complete = events.find((event) => event.event === 'complete')

    expect(response.status).toBe(200)
    expect(complete?.data).toMatchObject({
      brandId: 'brand-1',
    })
    expect(events.some((event) => event.event === 'error')).toBe(false)
  })

  it('skips evidence quickly when Tavily fails and still completes the import', async () => {
    process.env.TAVILY_API_KEY = 'test-tavily-key'

    const supabase = createImportSupabaseMock()
    createServerSupabaseClient.mockResolvedValue(supabase.client)
    isTavilyReachable.mockResolvedValue(true)
    extractClaims.mockResolvedValue([
      {
        id: 'claim-1',
        text: '15% faster delivery',
        type: 'hard',
        category: 'performance',
        riskScore: 70,
        flags: ['metric'],
        evidenceExpectation: 'benchmark data',
      },
    ])
    researchAllClaims.mockRejectedValue(new Error('dns lookup failed'))

    const response = await executeImport()
    const events = await readSse(response)
    const complete = events.find((event) => event.event === 'complete')

    expect(complete?.data).toMatchObject({
      evidenceStatus: 'skipped',
    })
    expect(complete?.data).toHaveProperty('evidenceMessage')
    expect(autoLinkEvidence).toHaveBeenCalledWith(
      expect.any(Array),
      expect.any(Map),
      expect.objectContaining({ skipRewriteGeneration: true }),
    )
  })

  it('skips evidence before research when Tavily is unreachable', async () => {
    process.env.TAVILY_API_KEY = 'test-tavily-key'

    const supabase = createImportSupabaseMock()
    createServerSupabaseClient.mockResolvedValue(supabase.client)
    isTavilyReachable.mockResolvedValue(false)
    extractClaims.mockResolvedValue([
      {
        id: 'claim-1',
        text: 'Customers save 30% on tooling spend',
        type: 'hard',
        category: 'roi',
        riskScore: 65,
        flags: ['financial'],
        evidenceExpectation: 'pricing data',
      },
    ])

    const response = await executeImport()
    const events = await readSse(response)
    const complete = events.find((event) => event.event === 'complete')

    expect(complete?.data).toMatchObject({
      evidenceStatus: 'skipped',
      evidenceMessage: 'Evidence research skipped because Tavily is unreachable right now.',
    })
    expect(researchAllClaims).not.toHaveBeenCalled()
    expect(autoLinkEvidence).toHaveBeenCalledWith(
      expect.any(Array),
      expect.any(Map),
      expect.objectContaining({ skipRewriteGeneration: true }),
    )
  })

  it('normalizes imported claim categories to the database-safe enum before persistence', async () => {
    const supabase = createImportSupabaseMock()
    createServerSupabaseClient.mockResolvedValue(supabase.client)
    extractClaims.mockResolvedValue([
      {
        id: 'claim-1',
        text: 'Customers save 30% on tooling spend',
        type: 'hard',
        category: 'roi',
        riskScore: 70,
        flags: ['financial'],
        evidenceExpectation: 'pricing data',
      },
      {
        id: 'claim-2',
        text: 'Trusted by product teams worldwide',
        type: 'soft',
        category: 'testimonial',
        riskScore: 20,
        flags: [],
        evidenceExpectation: 'customer proof',
      },
    ])

    const response = await executeImport()
    await readSse(response)

    const firstClaimPayload = supabase.claimsInsert.mock.calls[0]?.[0] as Record<string, unknown>
    const secondClaimPayload = supabase.claimsInsert.mock.calls[1]?.[0] as Record<string, unknown>

    expect(firstClaimPayload.category).toBe('pricing')
    expect(secondClaimPayload.category).toBe('generic')
  })

  it('emits an error event instead of a fake success when brand persistence fails', async () => {
    const supabase = createImportSupabaseMock({ brandSaveError: 'column does not exist' })
    createServerSupabaseClient.mockResolvedValue(supabase.client)

    const response = await executeImport()
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
