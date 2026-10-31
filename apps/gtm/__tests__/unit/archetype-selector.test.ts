/**
 * Design Archetype Selector Unit Tests
 *
 * Tests the pure selector functions that map BrandContext to DesignArchetype.
 */

import { describe, it, expect } from 'vitest'
import {
  selectLandingPageArchetype,
  selectSocialVisualStyle,
  selectCornerStyle,
  cornerStyleToRadius,
  selectDesignArchetype,
} from '@/lib/design/archetype-selector'
import { getDefaultBrandContext, type BrandContext } from '@/lib/ai/brand-context'

// ---------------------------------------------------------------------------
// Fixture helper
// ---------------------------------------------------------------------------

function makeBrand(overrides: Partial<BrandContext> = {}): BrandContext {
  return {
    name: 'Test Brand',
    industry: 'saas',
    colors: { primary: '#3b82f6' },
    typography: { fontFamily: 'Inter' },
    voice: {
      tone: 'Professional',
      attributes: [],
      scores: { formality: 3, humor: 2, technicalDepth: 3 },
    },
    messaging: { keyMessages: [], valuePropositions: [] },
    visualStyle: { theme: 'light', corners: 'rounded' },
    guidelines: { dos: [], donts: [] },
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// selectLandingPageArchetype
// ---------------------------------------------------------------------------

describe('selectLandingPageArchetype', () => {
  it("returns 'developer' for technicalDepth >= 4", () => {
    expect(selectLandingPageArchetype('saas', 4, 'light')).toBe('developer')
    expect(selectLandingPageArchetype('saas', 5, 'light')).toBe('developer')
  })

  it("returns 'developer' for industry containing 'api'", () => {
    expect(selectLandingPageArchetype('api', 2, 'light')).toBe('developer')
  })

  it("returns 'developer' for industry 'api platform'", () => {
    expect(selectLandingPageArchetype('api platform', 2, 'light')).toBe('developer')
  })

  it("returns 'trust-forward' for industry 'fintech'", () => {
    expect(selectLandingPageArchetype('fintech', 2, 'light')).toBe('trust-forward')
  })

  it("returns 'trust-forward' for industry 'healthcare software'", () => {
    expect(selectLandingPageArchetype('healthcare software', 2, 'light')).toBe('trust-forward')
  })

  it("returns 'storytelling' for industry 'creative agency'", () => {
    expect(selectLandingPageArchetype('creative agency', 2, 'light')).toBe('storytelling')
  })

  it("returns 'product-led' for industry 'saas' with technicalDepth 3", () => {
    expect(selectLandingPageArchetype('saas', 3, 'light')).toBe('product-led')
  })

  it("returns 'conversion' as default for generic industry like 'b2b consulting'", () => {
    expect(selectLandingPageArchetype('b2b consulting', 2, 'light')).toBe('conversion')
  })

  it('theme parameter does NOT change the result (current behavior: theme is unused)', () => {
    const withLight = selectLandingPageArchetype('fintech', 2, 'light')
    const withDark = selectLandingPageArchetype('fintech', 2, 'dark')
    expect(withLight).toBe(withDark)

    const genericLight = selectLandingPageArchetype('b2b consulting', 2, 'light')
    const genericDark = selectLandingPageArchetype('b2b consulting', 2, 'dark')
    expect(genericLight).toBe(genericDark)
  })
})

// ---------------------------------------------------------------------------
// selectSocialVisualStyle
// ---------------------------------------------------------------------------

describe('selectSocialVisualStyle', () => {
  it("returns 'technical' for industry 'cli tools'", () => {
    expect(selectSocialVisualStyle('cli tools', 'light', 3)).toBe('technical')
  })

  it("returns 'editorial' for industry 'design studio'", () => {
    expect(selectSocialVisualStyle('design studio', 'light', 3)).toBe('editorial')
  })

  it("returns 'minimal' for formality 5", () => {
    expect(selectSocialVisualStyle('b2b consulting', 'light', 5)).toBe('minimal')
  })

  it("returns 'bold' as default for industry 'startup', formality 3", () => {
    expect(selectSocialVisualStyle('startup', 'light', 3)).toBe('bold')
  })
})

// ---------------------------------------------------------------------------
// selectCornerStyle
// ---------------------------------------------------------------------------

describe('selectCornerStyle', () => {
  it("returns 'sharp' for legal industry even when corners param is 'rounded'", () => {
    expect(selectCornerStyle('rounded', 'legal software', 3)).toBe('sharp')
  })

  it("returns 'pill' when corners param is 'pill'", () => {
    expect(selectCornerStyle('pill', 'saas', 3)).toBe('pill')
  })

  it("returns 'soft' for formality 4", () => {
    expect(selectCornerStyle('rounded', 'saas', 4)).toBe('soft')
  })

  it("returns 'rounded' for formality 2", () => {
    expect(selectCornerStyle('rounded', 'saas', 2)).toBe('rounded')
  })
})

// ---------------------------------------------------------------------------
// cornerStyleToRadius
// ---------------------------------------------------------------------------

describe('cornerStyleToRadius', () => {
  it("maps sharp → '2px'", () => {
    expect(cornerStyleToRadius('sharp')).toBe('2px')
  })

  it("maps soft → '6px'", () => {
    expect(cornerStyleToRadius('soft')).toBe('6px')
  })

  it("maps rounded → '12px'", () => {
    expect(cornerStyleToRadius('rounded')).toBe('12px')
  })

  it("maps pill → '9999px'", () => {
    expect(cornerStyleToRadius('pill')).toBe('9999px')
  })
})

// ---------------------------------------------------------------------------
// selectDesignArchetype (integration)
// ---------------------------------------------------------------------------

describe('selectDesignArchetype', () => {
  it('developer brand: correct archetype cluster', () => {
    const brand = makeBrand({
      industry: 'developer tools',
      visualStyle: { theme: 'dark', corners: 'rounded' },
      voice: {
        tone: 'Technical',
        attributes: [],
        scores: { formality: 3, humor: 2, technicalDepth: 5 },
      },
    })

    const result = selectDesignArchetype(brand)

    expect(result.landingPage).toBe('developer')
    expect(result.prefersDark).toBe(true)
    // 'developer tools' doesn't trigger the legal/banking/finance/government sharp rule;
    // with corners='rounded' and formality=3 the selector returns 'soft'
    expect(result.corners).toBe('soft')
    expect(result.socialVisual).toBe('technical')
    expect(result.deck).toBe('clean-dark')
  })

  it('fintech brand: trust-forward with spacious + email styles', () => {
    const brand = makeBrand({
      industry: 'fintech',
      visualStyle: { theme: 'light', corners: 'rounded' },
      voice: {
        tone: 'Formal',
        attributes: [],
        scores: { formality: 5, humor: 1, technicalDepth: 2 },
      },
    })

    const result = selectDesignArchetype(brand)

    expect(result.landingPage).toBe('trust-forward')
    expect(result.spacingDensity).toBe('spacious')
    expect(result.emailStyle.cold).toBe('near-plain')
    expect(result.emailStyle.announcement).toBe('full-branded')
  })

  it('creative brand: storytelling + editorial + pill corners', () => {
    const brand = makeBrand({
      industry: 'creative agency',
      visualStyle: { theme: 'light', corners: 'pill' },
      voice: {
        tone: 'Casual',
        attributes: [],
        scores: { formality: 2, humor: 4, technicalDepth: 1 },
      },
    })

    const result = selectDesignArchetype(brand)

    expect(result.landingPage).toBe('storytelling')
    expect(result.socialVisual).toBe('editorial')
    expect(result.corners).toBe('pill')
  })

  it('is deterministic: same brand input always returns equal output', () => {
    const brand = makeBrand({
      industry: 'saas platform',
      visualStyle: { theme: 'light', corners: 'rounded' },
      voice: {
        tone: 'Professional',
        attributes: [],
        scores: { formality: 3, humor: 2, technicalDepth: 3 },
      },
    })

    const first = selectDesignArchetype(brand)
    const second = selectDesignArchetype(brand)

    expect(first).toEqual(second)
  })

  it("reasoning string contains 'archetype=' and the industry value", () => {
    const brand = makeBrand({
      industry: 'fintech',
      visualStyle: { theme: 'light', corners: 'rounded' },
      voice: {
        tone: 'Professional',
        attributes: [],
        scores: { formality: 3, humor: 2, technicalDepth: 2 },
      },
    })

    const result = selectDesignArchetype(brand)

    expect(result.reasoning).toContain('archetype=')
    expect(result.reasoning).toContain('fintech')
  })

  it('honors explicit design direction overrides', () => {
    const brand = makeBrand({
      industry: 'saas',
      visualStyle: { theme: 'light', corners: 'rounded' },
      voice: {
        tone: 'Professional',
        attributes: [],
        scores: { formality: 3, humor: 1, technicalDepth: 2 },
      },
    })

    const result = selectDesignArchetype(brand, 'technical')

    expect(result.direction).toBe('technical')
    expect(result.landingPage).toBe('developer')
    expect(result.source).toBe('override')
  })

  it('neutral fallback brand no longer resolves to purple gradient defaults', () => {
    const result = selectDesignArchetype(getDefaultBrandContext())

    expect(result.prefersDark).toBe(false)
    expect(result.source).toBe('neutral-fallback')
    expect(result.backgroundTreatment).toBe('tinted')
    expect(result.motionPolicy).toBe('none')
    expect(result.ornamentLevel).toBe('none')
  })
})
