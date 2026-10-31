import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/brain/service', () => ({
  resolveApprovedBrainSnapshot: vi.fn().mockResolvedValue(null),
  getBrainContext: vi.fn().mockResolvedValue(null),
  buildBrainPromptContext: vi.fn(() => ''),
}))

import type { BrandContext } from '@/lib/ai/brand-context'
import { buildGenerationPlan, applyReviewActionToPlan } from '@/lib/planning/generation-plan'

function makeBrand(overrides: Partial<BrandContext> = {}): BrandContext {
  return {
    name: 'Test Brand',
    industry: 'saas',
    colors: { primary: '#111827' },
    typography: { fontFamily: 'IBM Plex Sans' },
    voice: {
      tone: 'Professional',
      attributes: [],
      scores: { formality: 3, humor: 1, technicalDepth: 3 },
    },
    messaging: { keyMessages: [], valuePropositions: [] },
    visualStyle: { theme: 'light', corners: 'rounded' },
    guidelines: { dos: [], donts: [] },
    claims: { approved: [], risky: [] },
    ...overrides,
  }
}

describe('buildGenerationPlan', () => {
  it('derives a compliance-proof plan for regulated approval audiences', async () => {
    const plan = await buildGenerationPlan({
      workspaceId: 'ws_123',
      brandContext: makeBrand({ industry: 'fintech infrastructure' }),
      designDirection: 'trust',
      assetTypes: ['landing-page', 'deck'],
      brief: {
        name: 'Security review launch',
        audience: 'CFO and compliance leads',
        goal: 'Get internal approval from finance and security',
        offer: 'Automated controls reporting',
        cta: 'Request approval',
      },
    })

    expect(plan.primaryActor.role).toBe('approver')
    expect(plan.decisionStage).toBe('convert')
    expect(plan.proofStrategy).toBe('compliance-proof')
    expect(plan.creativeRoutes[0]?.label).toBe('Proof First')
    expect(plan.constraints.visualBans).toContain('No cursor-follow effects or scroll-jacking')
  })

  it('produces materially different routes for product and editorial directions', async () => {
    const developerPlan = await buildGenerationPlan({
      workspaceId: 'ws_123',
      brandContext: makeBrand({
        industry: 'developer tools',
        voice: {
          tone: 'Technical',
          attributes: [],
          scores: { formality: 3, humor: 1, technicalDepth: 5 },
        },
      }),
      designDirection: 'product',
      assetTypes: ['landing-page', 'social'],
      brief: {
        audience: 'Platform engineers',
        goal: 'Help buyers evaluate the product',
        offer: 'Incident debugging workflow',
        cta: 'Book a demo',
      },
    })

    const editorialPlan = await buildGenerationPlan({
      workspaceId: 'ws_123',
      brandContext: makeBrand({
        industry: 'creative collaboration',
        voice: {
          tone: 'Editorial',
          attributes: [],
          scores: { formality: 2, humor: 2, technicalDepth: 1 },
        },
      }),
      designDirection: 'editorial',
      assetTypes: ['landing-page', 'social'],
      brief: {
        audience: 'Brand marketers',
        goal: 'Help teams discover a new creative workflow',
        offer: 'Story-led launch toolkit',
        cta: 'See the workflow',
      },
    })

    expect(developerPlan.creativeRoutes[0]?.label).toBe('Product Walkthrough')
    expect(editorialPlan.creativeRoutes[0]?.label).toBe('Narrative Opener')
    expect(developerPlan.assetBlueprints[0]?.requiredSections).not.toEqual(
      editorialPlan.assetBlueprints[0]?.requiredSections,
    )
  })

  it('supports neutral fallback and review-action refinement', async () => {
    const plan = await buildGenerationPlan({
      workspaceId: 'ws_123',
      designDirection: 'auto',
      assetTypes: ['landing-page'],
      brief: {
        audience: 'Operations leaders',
        goal: 'Introduce the offer',
        offer: 'New launch workflow',
        cta: 'Learn more',
      },
    })

    expect(plan.source).toBe('fallback')

    const refined = applyReviewActionToPlan(plan, 'increase-proof')
    expect(refined.proofStrategy).toBe('evidence-stack')
    expect(refined.constraints.proofBlockers.some((entry) => entry.includes('supported metric'))).toBe(true)
  })

  it('biases proof strategy and constraints from imported proof hints', async () => {
    const plan = await buildGenerationPlan({
      workspaceId: 'ws_123',
      brandContext: makeBrand({
        proofHints: {
          recommendedStrategy: 'product-proof',
          candidates: ['Imported workflow proof: Live query trace'],
          gaps: ['Need a concrete walkthrough screenshot'],
        },
      }),
      designDirection: 'auto',
      assetTypes: ['landing-page'],
      brief: {
        audience: 'Platform engineers',
        goal: 'Help buyers evaluate the workflow',
        offer: 'Query-first tracing',
        cta: 'See the workflow',
      },
    })

    expect(plan.proofStrategy).toBe('product-proof')
    expect(plan.constraints.mustInclude).toEqual(
      expect.arrayContaining(['Imported workflow proof: Live query trace']),
    )
    expect(plan.constraints.proofBlockers).toEqual(
      expect.arrayContaining([
        'Need a concrete walkthrough screenshot',
        expect.stringContaining('Prefer supportable proof such as: Imported workflow proof: Live query trace'),
      ]),
    )
  })
})
