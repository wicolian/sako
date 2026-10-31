import { describe, expect, it } from 'vitest'

import type { GenerationPlan } from '@/lib/planning/types'
import { buildReviewSignals, recommendReviewActions } from '@/lib/planning/review-signals'

const plan: GenerationPlan = {
  objective: 'Help security leaders approve the product',
  summary: 'Security leaders need enough proof to approve the product.',
  primaryActor: {
    label: 'Security leaders',
    role: 'approver',
    goal: 'Approve a compliant tool',
    concerns: ['Compliance', 'Risk', 'Reviewable proof'],
  },
  decisionStage: 'justify',
  proofStrategy: 'compliance-proof',
  constraints: {
    mustInclude: ['A single dominant next step'],
    mustAvoid: ['Vague superlatives'],
    proofBlockers: ['Include at least one defensible metric, supported claim, or evidence-backed statement'],
    visualBans: ['No cursor-follow effects or scroll-jacking'],
  },
  assetBlueprints: [
    {
      assetType: 'landing-page',
      objective: 'Guide security leaders from overview to approval',
      requiredSections: ['hero', 'proof', 'faq', 'cta'],
      proofRequirements: ['metric', 'testimonial'],
      channelNotes: 'Make the CTA obvious without gimmicks.',
    },
  ],
  creativeRoutes: [
    {
      id: 'route-proof-first',
      label: 'Proof First',
      summary: 'Lead with credibility and safe next steps.',
      headlineAngle: 'Start with the most credible reason to believe',
      proofPosture: 'heavy',
      visualBias: 'trust',
      restraint: 'strict',
      heroFraming: 'proof-led',
      proofPlacement: 'hero',
      typographyMode: 'trust',
      ctaStyle: 'outline',
      motionPolicy: 'none',
      ornamentAllowance: 'none',
      visualDensity: 'airy',
      landingOrder: ['hero', 'stats', 'testimonials', 'faq', 'cta'],
      confidence: 0.9,
    },
  ],
  selectedRoute: 'route-proof-first',
  source: 'brand',
}

describe('buildReviewSignals', () => {
  it('penalizes generic slop and recommends proof/restraint fixes', () => {
    const html = `
      <style>
        .hero { background: linear-gradient(135deg, #6366f1, #8b5cf6); }
        .card:hover { transform: translateY(-4px) scale(1.02); }
        .glass { backdrop-filter: blur(16px); }
      </style>
      <section class="hero">
        <h1>Launch faster 🚀</h1>
        <p>The best platform ever for everyone.</p>
        <div class="glass">No evidence here</div>
      </section>
    `

    const signals = buildReviewSignals('landing-page', html, plan)
    const lookup = Object.fromEntries(signals.map((signal) => [signal.key, signal.score]))

    expect(lookup.restraint).toBeLessThan(75)
    expect(lookup.brandFit).toBeLessThan(75)
    expect(lookup.proofCoverage).toBeLessThan(75)
    expect(recommendReviewActions(signals)).toEqual(
      expect.arrayContaining(['increase-proof', 'reduce-ornament']),
    )
  })

  it('rewards proof-forward actor-fit output', () => {
    const content = `
      Security leaders need reviewable proof before approving new tools.
      Reviewed by 28 teams with a 42% faster audit workflow.
      The compliance review package includes customer evidence, a case study, explicit proof, and a clear CTA to book a demo.
    `

    const signals = buildReviewSignals('email', content, plan)
    const lookup = Object.fromEntries(signals.map((signal) => [signal.key, signal.score]))

    expect(lookup.proofCoverage).toBeGreaterThanOrEqual(75)
    expect(lookup.actorFit).toBeGreaterThanOrEqual(75)
    expect(lookup.channelFit).toBeGreaterThanOrEqual(75)
  })
})
