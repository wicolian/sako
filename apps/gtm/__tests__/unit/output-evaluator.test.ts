import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/brain/service', () => ({
  resolveApprovedBrainSnapshot: vi.fn().mockResolvedValue(null),
  getBrainContext: vi.fn().mockResolvedValue(null),
  buildBrainPromptContext: vi.fn(() => ''),
}))

import { composerSeedFixtures } from '@/__tests__/fixtures/composer-seeds'
import { buildGenerationPlan } from '@/lib/planning/generation-plan'
import { buildSurgicalRegenerationContext, evaluateAssetOutput } from '@/lib/planning/output-evaluator'

describe('output evaluator', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('detects common slop patterns with machine-readable issue codes', async () => {
    const fixture = composerSeedFixtures.find((entry) => entry.id === 'plg-saas')
    if (!fixture) throw new Error('Missing fixture')

    const plan = await buildGenerationPlan({
      workspaceId: 'ws_eval',
      brandContext: fixture.brand,
      designDirection: fixture.designDirection,
      assetTypes: fixture.assetTypes,
      brief: fixture.brief,
    })

    const html = `
      <style>
        .hero { background: linear-gradient(135deg, #6366f1, #8b5cf6); }
        .card:hover { transform: translateY(-4px) scale(1.03); }
        .glass { backdrop-filter: blur(18px); }
        .muted { color: #9ca3af; }
      </style>
      <section class="hero">
        <h1>The best platform for modern teams</h1>
        <p>Launch faster with a seamless next generation workflow.</p>
        <div class="glass">Trusted by everyone</div>
      </section>
    `

    const evaluation = evaluateAssetOutput('landing-page', html, plan)
    const codes = evaluation.issues.map((issue) => issue.code)

    expect(codes).toEqual(
      expect.arrayContaining([
        'purple_gradient_default',
        'hover_gimmick',
        'glassmorphism_overuse',
        'generic_filler_copy',
      ]),
    )
    expect(evaluation.scores.restraint).toBeLessThan(75)
    expect(evaluation.scores.distinctiveness).toBeLessThan(75)
  })

  it('preserves strong sections during surgical regeneration guidance', async () => {
    const fixture = composerSeedFixtures.find((entry) => entry.id === 'security-saas')
    if (!fixture) throw new Error('Missing fixture')

    const plan = await buildGenerationPlan({
      workspaceId: 'ws_eval',
      brandContext: fixture.brand,
      designDirection: fixture.designDirection,
      assetTypes: fixture.assetTypes,
      brief: fixture.brief,
    })

    const html = `
      <section class="hero">
        <h1>Security leaders get reviewable proof before rollout</h1>
        <p>42% faster audit preparation with customer evidence and explicit controls mapping.</p>
        <a class="cta-button" href="#cta">Request security review</a>
      </section>
      <section class="stats-strip">42% faster audit prep</section>
      <section class="cta-section" id="cta">Request security review</section>
    `

    const evaluation = evaluateAssetOutput('landing-page', html, plan, { existingContent: html })
    const improve = buildSurgicalRegenerationContext('landing-page', evaluation, 'increase-proof', html)

    expect(evaluation.preserve).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Keep the selected'),
        'Preserve the current headline/CTA hierarchy',
        'Preserve the existing proof blocks and approved claims where possible',
        'Do not rewrite the hero unless the requested action directly requires it',
      ]),
    )
    expect(improve).toContain('Do not rewrite these unless absolutely necessary')
    expect(improve).toContain('Use the current asset as the structural baseline and edit surgically')
  })
})
