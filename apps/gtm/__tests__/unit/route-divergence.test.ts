import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/brain/service', () => ({
  resolveApprovedBrainSnapshot: vi.fn().mockResolvedValue(null),
  getBrainContext: vi.fn().mockResolvedValue(null),
  buildBrainPromptContext: vi.fn(() => ''),
}))

import { composerSeedFixtures } from '@/__tests__/fixtures/composer-seeds'
import { selectDesignArchetype } from '@/lib/design/archetype-selector'
import { generateLandingPageHtml } from '@/lib/html/generator'
import { buildGenerationPlan, getSelectedCreativeRoute } from '@/lib/planning/generation-plan'

describe('route divergence', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('produces materially different route metadata across seeded fixtures', async () => {
    const plans = await Promise.all(
      composerSeedFixtures.map((fixture) =>
        buildGenerationPlan({
          workspaceId: `ws_${fixture.id}`,
          brandContext: fixture.brand,
          designDirection: fixture.designDirection,
          assetTypes: fixture.assetTypes,
          brief: fixture.brief,
        }),
      ),
    )

    const selected = plans.map((plan) => getSelectedCreativeRoute(plan))
    const heroFramings = new Set(selected.map((route) => route.heroFraming))
    const ctaStyles = new Set(selected.map((route) => route.ctaStyle))
    const landingOrders = new Set(selected.map((route) => route.landingOrder.join('>')))

    expect(heroFramings.size).toBeGreaterThanOrEqual(3)
    expect(ctaStyles.size).toBeGreaterThanOrEqual(2)
    expect(landingOrders.size).toBeGreaterThanOrEqual(4)
  })

  it('changes hero framing, section order, and CTA treatment for trust vs editorial routes', async () => {
    const trustFixture = composerSeedFixtures.find((entry) => entry.id === 'security-saas')
    const editorialFixture = composerSeedFixtures.find((entry) => entry.id === 'plg-saas')
    if (!trustFixture || !editorialFixture) throw new Error('Missing fixtures')

    const trustPlan = await buildGenerationPlan({
      workspaceId: 'ws_trust',
      brandContext: trustFixture.brand,
      designDirection: 'trust',
      assetTypes: ['landing-page'],
      brief: trustFixture.brief,
    })
    const editorialPlan = await buildGenerationPlan({
      workspaceId: 'ws_editorial',
      brandContext: editorialFixture.brand,
      designDirection: 'editorial',
      assetTypes: ['landing-page'],
      brief: {
        ...editorialFixture.brief,
        goal: 'Help teams discover a more memorable onboarding story',
      },
    })

    const trustRoute = getSelectedCreativeRoute(trustPlan)
    const editorialRoute = getSelectedCreativeRoute(editorialPlan)
    const trustHtml = generateLandingPageHtml(
      {
        id: 'trust',
        name: 'Security review',
        goal: 'Reviewable proof before rollout',
        cta: 'Request security review',
      },
      [],
      null,
      {
        brand: trustFixture.brand,
        archetype: selectDesignArchetype(trustFixture.brand, 'trust'),
        route: trustRoute,
        includeMeta: false,
      },
    )
    const editorialHtml = generateLandingPageHtml(
      {
        id: 'editorial',
        name: 'Story-led onboarding',
        goal: 'A more memorable activation arc',
        cta: 'See the workflow',
      },
      [],
      null,
      {
        brand: editorialFixture.brand,
        archetype: selectDesignArchetype(editorialFixture.brand, 'editorial'),
        route: editorialRoute,
        includeMeta: false,
      },
    )

    expect(trustRoute.heroFraming).not.toBe(editorialRoute.heroFraming)
    expect(trustRoute.ctaStyle).not.toBe(editorialRoute.ctaStyle)
    expect(trustRoute.landingOrder).not.toEqual(editorialRoute.landingOrder)

    expect(trustHtml).toContain('Proof-led overview')
    expect(editorialHtml).toContain('Story-driven launch')
    expect(trustHtml).toContain('border: 1px solid var(--brand-border);')
    expect(editorialHtml).toContain('border-radius: 9999px;')
  })
})
