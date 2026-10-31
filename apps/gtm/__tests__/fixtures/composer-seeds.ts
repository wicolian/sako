import type { BrandContext } from '@/lib/ai/brand-context'
import type { DesignDirection } from '@/lib/design/archetype-selector'

export interface ComposerSeedFixture {
  id: string
  label: string
  designDirection: DesignDirection
  assetTypes: Array<'landing-page' | 'email' | 'social' | 'deck'>
  brief: {
    name: string
    audience: string
    goal: string
    offer: string
    cta: string
  }
  brand: BrandContext
}

function makeBrand(overrides: Partial<BrandContext> = {}): BrandContext {
  return {
    name: 'Seed Brand',
    tagline: 'Imported from fixture',
    targetAudience: 'Software teams',
    industry: 'saas',
    colors: {
      primary: '#111827',
      secondary: '#334155',
      accent: '#0f766e',
      background: '#ffffff',
      text: '#111827',
    },
    typography: {
      fontFamily: 'IBM Plex Sans',
      fontHeading: 'Newsreader',
      fontMono: 'IBM Plex Mono',
    },
    voice: {
      tone: 'Measured and specific',
      attributes: ['clear', 'credible'],
      scores: {
        formality: 4,
        humor: 1,
        technicalDepth: 3,
      },
    },
    messaging: {
      keyMessages: ['Show what changed', 'Support every claim'],
      valuePropositions: ['Reduce friction with clear proof'],
      differentiators: ['Imported brand context'],
    },
    visualStyle: {
      theme: 'light',
      corners: 'soft',
      shadows: 'none',
      animations: 'none',
    },
    guidelines: {
      dos: ['Lead with proof'],
      donts: ['Use vague superlatives'],
    },
    claims: {
      approved: [{ text: 'Used by 120 teams', category: 'social-proof' }],
      risky: [{ text: 'Best-in-class automation', category: 'comparison', status: 'needs_proof' }],
    },
    proofHints: {
      recommendedStrategy: 'evidence-stack',
      candidates: ['Imported site metric: Used by 120 teams', 'Imported logo proof: Acme Security'],
      gaps: ['Need a reviewable metric with a source or timeframe'],
    },
    ...overrides,
  }
}

export const composerSeedFixtures: ComposerSeedFixture[] = [
  {
    id: 'security-saas',
    label: 'B2B SaaS security',
    designDirection: 'trust',
    assetTypes: ['landing-page', 'deck'],
    brief: {
      name: 'Security review campaign',
      audience: 'Security leaders and compliance approvers',
      goal: 'Help teams justify a security review purchase',
      offer: 'Continuous controls monitoring',
      cta: 'Request security review',
    },
    brand: makeBrand({
      name: 'Sentinel Grid',
      industry: 'security compliance',
      proofHints: {
        recommendedStrategy: 'compliance-proof',
        candidates: ['Imported site metric: 42% faster audit preparation', 'Imported testimonial: SOC 2 team reduced review time'],
        gaps: ['Need a certification, audit report, or reviewable compliance artifact'],
      },
    }),
  },
  {
    id: 'devtools',
    label: 'Devtools',
    designDirection: 'technical',
    assetTypes: ['landing-page', 'social'],
    brief: {
      name: 'Tracing launch',
      audience: 'Platform engineers',
      goal: 'Help teams evaluate a new tracing workflow',
      offer: 'Query-first debugging',
      cta: 'Book a technical demo',
    },
    brand: makeBrand({
      name: 'Traceforge',
      industry: 'developer tools',
      voice: {
        tone: 'Precise and technical',
        attributes: ['technical', 'calm'],
        scores: { formality: 3, humor: 1, technicalDepth: 5 },
      },
      proofHints: {
        recommendedStrategy: 'product-proof',
        candidates: ['Imported site metric: Mean-time-to-resolution reduced by 33%', 'Imported workflow proof: Debug traces across services in one view'],
        gaps: ['Need a concrete workflow walkthrough or screenshot-backed product proof'],
      },
    }),
  },
  {
    id: 'ai-infra',
    label: 'AI infra',
    designDirection: 'product',
    assetTypes: ['landing-page', 'email'],
    brief: {
      name: 'Inference optimization',
      audience: 'ML platform teams',
      goal: 'Help buyers compare model serving infrastructure',
      offer: 'Lower latency inference orchestration',
      cta: 'See the architecture',
    },
    brand: makeBrand({
      name: 'Layerbeam',
      industry: 'AI infrastructure',
      proofHints: {
        recommendedStrategy: 'evidence-stack',
        candidates: ['Imported site metric: 28% lower latency at peak load', 'Imported logo proof: Used by production AI teams'],
        gaps: ['Need a benchmark setup or source attribution for latency claims'],
      },
    }),
  },
  {
    id: 'fintech',
    label: 'Fintech',
    designDirection: 'trust',
    assetTypes: ['landing-page', 'email', 'deck'],
    brief: {
      name: 'Treasury workflow rollout',
      audience: 'Finance leaders and controllers',
      goal: 'Help teams justify adopting a treasury workflow',
      offer: 'Real-time cash controls',
      cta: 'Talk to treasury',
    },
    brand: makeBrand({
      name: 'Ledger Arc',
      industry: 'fintech',
      proofHints: {
        recommendedStrategy: 'compliance-proof',
        candidates: ['Imported site metric: Reconciliation time reduced by 12 hours weekly', 'Imported logo proof: Regional banks'],
        gaps: ['Need a policy statement, audit artifact, or explicit controls evidence'],
      },
    }),
  },
  {
    id: 'plg-saas',
    label: 'Product-led SaaS',
    designDirection: 'conversion',
    assetTypes: ['landing-page', 'social'],
    brief: {
      name: 'Self-serve activation',
      audience: 'Growth operators',
      goal: 'Convert trial users faster with clearer activation',
      offer: 'Collaborative onboarding workspace',
      cta: 'Start free',
    },
    brand: makeBrand({
      name: 'Latchflow',
      industry: 'product-led SaaS',
      proofHints: {
        recommendedStrategy: 'customer-proof',
        candidates: ['Imported testimonial: Team activated in one afternoon', 'Imported site metric: 18% higher activation'],
        gaps: ['Need an attributable customer quote or logo to support self-serve conversion claims'],
      },
    }),
  },
]
