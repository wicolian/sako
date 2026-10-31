import { describe, expect, it } from 'vitest'

import { getDefaultBrandContext, type BrandContext } from '@/lib/ai/brand-context'
import { selectDesignArchetype } from '@/lib/design/archetype-selector'
import { generateLandingPageHtml } from '@/lib/html/generator'

const makeBrand = (overrides: Partial<BrandContext> = {}): BrandContext => ({
  name: 'Linear',
  tagline: 'Plan and build products',
  industry: 'developer tools',
  targetAudience: 'Engineering teams shipping software fast',
  colors: {
    primary: '#5E6AD2',
    secondary: '#0F172A',
    accent: '#22C55E',
    background: '#09090B',
    text: '#F8FAFC',
  },
  typography: {
    fontFamily: 'IBM Plex Sans',
    fontHeading: 'IBM Plex Sans',
    fontMono: 'IBM Plex Mono',
  },
  voice: {
    tone: 'Precise and technical',
    attributes: ['confident', 'technical'],
    scores: {
      formality: 3,
      humor: 1,
      technicalDepth: 5,
    },
  },
  messaging: {
    keyMessages: ['Faster planning', 'Clear execution'],
    valuePropositions: ['Built for product and engineering teams'],
    differentiators: ['Fast issue tracking'],
  },
  visualStyle: {
    theme: 'dark',
    corners: 'sharp',
    shadows: 'subtle',
  },
  guidelines: {
    dos: [],
    donts: [],
  },
  claims: {
    approved: [],
    risky: [],
  },
  ...overrides,
})

describe('generateLandingPageHtml', () => {
  it('injects brand CSS variables and meta tags without decorative reveal scripts', () => {
    const brand = makeBrand()
    const archetype = selectDesignArchetype(brand)

    const html = generateLandingPageHtml(
      {
        id: 'campaign-1',
        name: 'Ship faster',
        goal: 'Give engineering teams one place to plan and deliver',
        cta: 'Start building',
      },
      [],
      null,
      { brand, archetype, includeMeta: true },
    )

    expect(html).toContain('--brand-primary: #5E6AD2;')
    expect(html).toContain('--font-heading: \'IBM Plex Sans\', system-ui, sans-serif;')
    expect(html).toContain('og:image')
    expect(html).not.toContain('IntersectionObserver')
    expect(html).not.toContain('data-reveal')
  })

  it('changes section order for trust-forward brands', () => {
    const trustBrand = makeBrand({
      industry: 'fintech',
      visualStyle: { theme: 'light', corners: 'rounded' },
      voice: {
        tone: 'Formal and measured',
        attributes: ['credible'],
        scores: { formality: 5, humor: 1, technicalDepth: 2 },
      },
    })
    const archetype = selectDesignArchetype(trustBrand)

    const html = generateLandingPageHtml(
      {
        id: 'campaign-2',
        name: 'Earn trust faster',
        goal: 'Security and compliance without the busywork',
        cta: 'Request demo',
      },
      [
        { id: 'benefit-1', type: 'benefits', order: 1, props: { title: 'Automated reviews', description: 'Cut manual review loops.' } },
        { id: 'testimonial-1', type: 'testimonial', order: 2, props: { quote: 'We closed reviews in half the time.', author: 'A. Customer', company: 'Mercury-like Co.' } },
      ],
      null,
      { brand: trustBrand, archetype, includeMeta: false },
    )

    expect(archetype.landingPage).toBe('trust-forward')
    const statsSectionIndex = html.indexOf('<div class="stats-strip"')
    const benefitsSectionIndex = html.indexOf('<div class="benefits-grid"')
    expect(statsSectionIndex).toBeGreaterThan(-1)
    expect(statsSectionIndex).toBeLessThan(benefitsSectionIndex)
  })

  it('escapes injected content safely', () => {
    const brand = makeBrand()
    const archetype = selectDesignArchetype(brand)

    const html = generateLandingPageHtml(
      {
        id: 'campaign-3',
        name: '<script>alert(1)</script>',
        goal: 'Stay safe',
        cta: 'Go',
      },
      [],
      {
        id: 'hero',
        type: 'hero',
        order: 0,
        props: {
          headline: '<img src=x onerror=alert(1)>',
          subheadline: 'Safe copy',
          cta_text: 'Click',
        },
      },
      { brand, archetype },
    )

    expect(html).not.toContain('<script>alert(1)</script>')
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;')
  })

  it('uses restrained neutral fallback tokens when no brand is available', () => {
    const fallbackBrand = getDefaultBrandContext()
    const archetype = selectDesignArchetype(fallbackBrand)

    const html = generateLandingPageHtml(
      {
        id: 'campaign-4',
        name: 'A careful fallback',
        goal: 'Brand-safe output without imported identity',
        cta: 'Request access',
      },
      [],
      null,
      { brand: fallbackBrand, archetype, includeMeta: false },
    )

    expect(html).toContain('--brand-primary: #1f2937;')
    expect(html).toContain('--brand-bg: #ffffff;')
    expect(html).not.toContain('#6366f1')
    expect(html).not.toContain('#8b5cf6')
  })
})
