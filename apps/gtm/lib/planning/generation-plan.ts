import type { BrandContext } from '@/lib/ai/brand-context'
import { getBrandContext, getDefaultBrandContext } from '@/lib/ai/brand-context'
import { buildBrainPromptContext, getBrainContext, resolveApprovedBrainSnapshot } from '@/lib/brain/service'
import type { DesignDirection } from '@/lib/design/archetype-selector'
import { selectDesignArchetype } from '@/lib/design/archetype-selector'
import { getSelectedCreativeRoute } from './plan-helpers'
import type {
  AssetBlueprint,
  CreativeRoute,
  GenerationPlan,
  PlanningActor,
  PlanAssetType,
  ProofStrategy,
  DecisionStage,
} from './types'

export { applyReviewActionToPlan, getSelectedCreativeRoute } from './plan-helpers'

interface PlannerBrief {
  name?: string | null
  audience?: string | null
  goal?: string | null
  offer?: string | null
  cta?: string | null
  constraints?: {
    mustInclude?: string[]
    mustAvoid?: string[]
  } | null
}

interface BuildGenerationPlanInput {
  workspaceId: string
  brandId?: string
  brief: PlannerBrief
  assetTypes?: string[]
  designDirection?: DesignDirection
  brandContext?: BrandContext | null
}

const REGULATED_INDUSTRY_PATTERN =
  /\b(fintech|finance|banking|insurance|healthcare|health|medical|legal|compliance|security)\b/i

const APPROVER_PATTERN = /\b(cfo|finance|legal|procurement|security|compliance|executive|vp|director|leadership)\b/i
const OPERATOR_PATTERN = /\b(operator|ops|admin|coordinator|manager|team|marketing|growth|revenue)\b/i
const TECHNICAL_PATTERN = /\b(engineer|developer|technical|platform|it|devops|architect)\b/i

const VISUAL_BANS = [
  'No decorative gradients unless the imported brand clearly uses them',
  'No cursor-follow effects or scroll-jacking',
  'No glass cards or fake browser/dashboard chrome',
  'No emoji filler or novelty icon clutter',
  'No hover-scale gimmicks as the primary interaction signal',
]

export async function buildGenerationPlan(input: BuildGenerationPlanInput): Promise<GenerationPlan> {
  const brandContext =
    input.brandContext ??
    (input.brandId ? await getBrandContext(input.workspaceId, input.brandId) : null) ??
    getDefaultBrandContext()

  const approvedSnapshot = await resolveApprovedBrainSnapshot(input.workspaceId, input.brandId)
  const brainContext = approvedSnapshot
    ? await getBrainContext(input.workspaceId, approvedSnapshot.id)
    : null
  const brainPrompt = brainContext ? buildBrainPromptContext(brainContext) : ''

  const effectiveDirection = input.designDirection ?? 'auto'
  const archetype = selectDesignArchetype(brandContext, effectiveDirection)
  const objective = buildObjective(input.brief)
  const decisionStage = determineDecisionStage(input.brief)
  const primaryActor = determinePrimaryActor(input.brief.audience, decisionStage, brandContext)
  const secondaryActor = determineSecondaryActor(decisionStage, primaryActor, brandContext)
  const proofStrategy = determineProofStrategy(decisionStage, effectiveDirection, brandContext)
  const constraints = buildConstraints(input.brief, brandContext, brainPrompt, proofStrategy)
  const assetBlueprints = buildAssetBlueprints(input.assetTypes, decisionStage, proofStrategy, primaryActor)
  const creativeRoutes = buildCreativeRoutes({
    objective,
    decisionStage,
    proofStrategy,
    direction: archetype.direction,
    primaryActor,
  })
  const selectedRoute = creativeRoutes
    .slice()
    .sort((left, right) => right.confidence - left.confidence)[0]?.id ?? creativeRoutes[0]?.id ?? 'route-1'
  const source: GenerationPlan['source'] = brainContext
    ? 'brain'
    : brandContext.name === 'Neutral Brand'
      ? 'fallback'
      : 'brand'

  return {
    objective,
    summary: `${primaryActor.label} needs enough proof to ${objective.toLowerCase()} during the ${decisionStage} stage.`,
    primaryActor,
    secondaryActor: secondaryActor ?? undefined,
    decisionStage,
    proofStrategy,
    constraints,
    assetBlueprints,
    creativeRoutes,
    selectedRoute,
    source,
  }
}

export function buildPlanPromptContext(plan: GenerationPlan): string {
  const route = getSelectedCreativeRoute(plan)
  const blueprintSummary = plan.assetBlueprints
    .map(
      (blueprint) =>
        `- ${blueprint.assetType}: ${blueprint.objective}. Required moments: ${blueprint.requiredSections.join(', ')}`,
    )
    .join('\n')

  return [
    'GENERATION PLAN:',
    `Objective: ${plan.objective}`,
    `Primary actor: ${plan.primaryActor.label} (${plan.primaryActor.role})`,
    plan.secondaryActor ? `Secondary actor: ${plan.secondaryActor.label} (${plan.secondaryActor.role})` : '',
    `Decision stage: ${plan.decisionStage}`,
    `Proof strategy: ${plan.proofStrategy}`,
    `Selected route: ${route.label} — ${route.summary}`,
    `Headline angle: ${route.headlineAngle}`,
    `Proof posture: ${route.proofPosture}`,
    `Visual restraint: ${route.restraint}`,
    `Hero framing: ${route.heroFraming}`,
    `Proof placement: ${route.proofPlacement}`,
    `Typography mode: ${route.typographyMode}`,
    `CTA style: ${route.ctaStyle}`,
    `Route motion policy: ${route.motionPolicy}`,
    `Ornament allowance: ${route.ornamentAllowance}`,
    `Visual density: ${route.visualDensity}`,
    `Landing order: ${route.landingOrder.join(', ')}`,
    plan.constraints.mustInclude.length > 0
      ? `Must include:\n${plan.constraints.mustInclude.map((entry) => `- ${entry}`).join('\n')}`
      : '',
    plan.constraints.mustAvoid.length > 0
      ? `Must avoid:\n${plan.constraints.mustAvoid.map((entry) => `- ${entry}`).join('\n')}`
      : '',
    plan.constraints.proofBlockers.length > 0
      ? `Proof blockers:\n${plan.constraints.proofBlockers.map((entry) => `- ${entry}`).join('\n')}`
      : '',
    blueprintSummary ? `Asset blueprints:\n${blueprintSummary}` : '',
  ]
    .filter(Boolean)
    .join('\n\n')
}

export function buildVisualTastePrompt(plan: GenerationPlan): string {
  const route = getSelectedCreativeRoute(plan)
  const proofInstruction =
    plan.proofStrategy === 'product-proof'
      ? 'Show the product and workflow clearly before decorative treatment.'
      : plan.proofStrategy === 'customer-proof'
        ? 'Give customer credibility and social proof more visual weight than ornament.'
        : 'Lead with evidence, support, and credibility before atmosphere.'

  return [
    'VISUAL TASTE RULES:',
    '- Use one clear visual idea, not multiple unrelated flourishes.',
    '- Keep motion semantic only. No scroll-jacking, cursor tracking, or attention traps.',
    '- Prefer proof, product clarity, and hierarchy over novelty.',
    '- Avoid fake dashboard chrome, browser-window framing, and emoji filler.',
    `Bias: ${route.visualBias}`,
    `Restraint target: ${route.restraint}`,
    `Proof posture: ${route.proofPosture}`,
    `Hero framing: ${route.heroFraming}`,
    `CTA style: ${route.ctaStyle}`,
    `Typography mode: ${route.typographyMode}`,
    `Visual density: ${route.visualDensity}`,
    proofInstruction,
  ].join('\n')
}

function buildObjective(brief: PlannerBrief): string {
  const goal = brief.goal?.trim()
  if (goal) return goal

  const cta = brief.cta?.trim() || 'take the next step'
  const offer = brief.offer?.trim() || brief.name?.trim() || 'the offer'
  return `Move the audience toward ${cta} by making ${offer} feel credible and worth acting on`
}

function determineDecisionStage(brief: PlannerBrief): DecisionStage {
  const text = [brief.goal, brief.offer, brief.cta].filter(Boolean).join(' ').toLowerCase()

  if (/\b(book|buy|signup|sign up|start|try|get started|request|apply|contact|demo)\b/.test(text)) {
    return 'convert'
  }

  if (/\b(approve|approval|justify|budget|buy-in|stakeholder|procurement|security review)\b/.test(text)) {
    return 'justify'
  }

  if (/\b(compare|evaluate|consider|shortlist|review|assess|pilot)\b/.test(text)) {
    return 'evaluate'
  }

  return 'discover'
}

function determinePrimaryActor(
  audience: string | null | undefined,
  stage: DecisionStage,
  brandContext: BrandContext,
): PlanningActor {
  const label = audience?.trim() || 'Prospective buyer'
  const normalized = label.toLowerCase()

  let role: PlanningActor['role'] = 'buyer'
  if (APPROVER_PATTERN.test(normalized)) {
    role = 'approver'
  } else if (TECHNICAL_PATTERN.test(normalized)) {
    role = 'evaluator'
  } else if (OPERATOR_PATTERN.test(normalized)) {
    role = stage === 'convert' ? 'buyer' : 'operator'
  } else if (stage === 'justify') {
    role = 'champion'
  }

  return {
    label,
    role,
    goal: buildActorGoal(stage, brandContext),
    concerns: buildActorConcerns(stage, brandContext),
  }
}

function determineSecondaryActor(
  stage: DecisionStage,
  primaryActor: PlanningActor,
  brandContext: BrandContext,
): PlanningActor | null {
  if (stage === 'discover' || primaryActor.role === 'approver') {
    return null
  }

  if (stage === 'justify') {
    return {
      label: 'Internal approver',
      role: 'approver',
      goal: 'See enough proof, safety, and fit to sign off',
      concerns: buildActorConcerns('justify', brandContext),
    }
  }

  return {
    label: 'Team champion',
    role: 'champion',
    goal: 'Carry the recommendation internally and de-risk the next step',
    concerns: buildActorConcerns(stage, brandContext),
  }
}

function buildActorGoal(stage: DecisionStage, brandContext: BrandContext): string {
  switch (stage) {
    case 'discover':
      return `Understand why ${brandContext.name} matters now`
    case 'evaluate':
      return 'Decide whether this fits the current workflow and problem'
    case 'justify':
      return 'Make a credible internal case with proof and low perceived risk'
    case 'convert':
      return 'Take the next action with minimal hesitation'
  }
}

function buildActorConcerns(stage: DecisionStage, brandContext: BrandContext): string[] {
  const concerns =
    stage === 'discover'
      ? ['What problem this solves', 'Why this matters now', 'Why this is different']
      : stage === 'evaluate'
        ? ['How it works in practice', 'Whether the proof is credible', 'Whether it fits current workflow']
        : stage === 'justify'
          ? ['Whether it is safe to approve', 'Whether the ROI is clear', 'Whether the proof is reviewable']
          : ['Why act now', 'What happens after the CTA', 'Whether the next step is low-friction']

  if (REGULATED_INDUSTRY_PATTERN.test(brandContext.industry ?? '')) {
    concerns.push('Compliance and evidence posture')
  }

  return uniqueStrings(concerns)
}

function determineProofStrategy(
  stage: DecisionStage,
  direction: DesignDirection,
  brandContext: BrandContext,
): ProofStrategy {
  const hintedStrategy = brandContext.proofHints?.recommendedStrategy
  if (hintedStrategy) {
    return hintedStrategy as ProofStrategy
  }

  if (REGULATED_INDUSTRY_PATTERN.test(brandContext.industry ?? '')) {
    return 'compliance-proof'
  }

  if (stage === 'justify' || stage === 'evaluate') {
    return 'evidence-stack'
  }

  if (direction === 'product') {
    return 'product-proof'
  }

  return 'customer-proof'
}

function buildConstraints(
  brief: PlannerBrief,
  brandContext: BrandContext,
  brainPrompt: string,
  proofStrategy: ProofStrategy,
): GenerationPlan['constraints'] {
  const mustInclude = uniqueStrings([
    ...(brief.constraints?.mustInclude ?? []),
    ...(brandContext.proofHints?.candidates.slice(0, 2) ?? []),
  ])
  const mustAvoid = uniqueStrings([
    ...(brief.constraints?.mustAvoid ?? []),
    ...((brandContext.guidelines?.donts ?? []).slice(0, 6)),
  ])
  const proofBlockers = uniqueStrings([
    ...buildProofBlockers(brandContext, brainPrompt, proofStrategy),
    ...(brandContext.proofHints?.gaps ?? []),
  ])

  return {
    mustInclude,
    mustAvoid,
    proofBlockers,
    visualBans: VISUAL_BANS,
  }
}

function buildProofBlockers(
  brandContext: BrandContext,
  brainPrompt: string,
  proofStrategy: ProofStrategy,
): string[] {
  const blockers: string[] = []

  if (proofStrategy === 'product-proof') {
    blockers.push('Show the product, workflow, or output before abstract claims')
  } else if (proofStrategy === 'customer-proof') {
    blockers.push('Include at least one testimonial, customer outcome, or social proof signal')
  } else {
    blockers.push('Include at least one defensible metric, supported claim, or evidence-backed statement')
  }

  const riskyClaims = brandContext.claims?.risky.slice(0, 3) ?? []
  if (riskyClaims.length > 0) {
    blockers.push(
      `Avoid unsupported claims such as: ${riskyClaims.map((claim) => claim.text).join('; ')}`,
    )
  }

  const legalLines = brainPrompt
    .split('\n')
    .filter((line) => line.startsWith('- ['))
    .slice(0, 3)
    .map((line) => line.replace(/^- \[[^\]]+\]\s*/, ''))
  blockers.push(...legalLines)

  if (brandContext.proofHints?.candidates.length) {
    blockers.push(
      `Prefer supportable proof such as: ${brandContext.proofHints.candidates.slice(0, 3).join('; ')}`,
    )
  }

  return blockers
}

function buildAssetBlueprints(
  requestedAssetTypes: string[] | undefined,
  stage: DecisionStage,
  proofStrategy: ProofStrategy,
  primaryActor: PlanningActor,
): AssetBlueprint[] {
  const assetTypes = normalizePlanAssetTypes(requestedAssetTypes)

  return assetTypes.map((assetType) => {
    switch (assetType) {
      case 'landing-page':
        return {
          assetType,
          objective: `Guide ${primaryActor.label} from first impression to the primary next step`,
          requiredSections: buildLandingSections(stage),
          proofRequirements: buildProofRequirements(proofStrategy),
          channelNotes: 'Make the CTA obvious without relying on decorative motion.',
        }
      case 'email':
        return {
          assetType,
          objective: `Move ${primaryActor.label} forward through a staged email sequence`,
          requiredSections: ['hook', 'proof', 'cta'],
          proofRequirements: buildProofRequirements(proofStrategy),
          channelNotes: 'Near-plain by default unless the route explicitly calls for a launch-style announcement.',
        }
      case 'social':
        return {
          assetType,
          objective: `Express the chosen route in short form while staying platform-aware`,
          requiredSections: ['hook', 'proof', 'cta'],
          proofRequirements: buildProofRequirements(proofStrategy),
          channelNotes: 'Vary proof and framing by platform instead of repeating the same summary.',
        }
      case 'deck':
        return {
          assetType,
          objective: `Support ${primaryActor.label} with a narrative they can defend internally`,
          requiredSections: buildDeckMoments(stage),
          proofRequirements: buildProofRequirements(proofStrategy),
          channelNotes: 'Bias toward strong typography, argument flow, and reviewable proof.',
        }
    }
  })
}

function buildCreativeRoutes(input: {
  objective: string
  decisionStage: DecisionStage
  proofStrategy: ProofStrategy
  direction: Exclude<DesignDirection, 'auto'>
  primaryActor: PlanningActor
}): CreativeRoute[] {
  const routesByDirection: Record<Exclude<DesignDirection, 'auto'>, CreativeRoute[]> = {
    trust: [
      {
        id: 'route-proof-first',
        label: 'Proof First',
        summary: 'Lead with credibility, proof, and safe next steps before stylistic flourish.',
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
      {
        id: 'route-risk-brief',
        label: 'Risk Brief',
        summary: 'Frame the offer as easy to approve, low-risk, and well-supported.',
        headlineAngle: 'Reduce risk before promising upside',
        proofPosture: 'heavy',
        visualBias: 'conversion',
        restraint: 'strict',
        heroFraming: 'technical-brief',
        proofPlacement: 'hero',
        typographyMode: 'trust',
        ctaStyle: 'outline',
        motionPolicy: 'none',
        ornamentAllowance: 'none',
        visualDensity: 'compact',
        landingOrder: ['hero', 'faq', 'stats', 'testimonials', 'cta'],
        confidence: 0.83,
      },
      {
        id: 'route-measured-demo',
        label: 'Measured Demo',
        summary: 'Show the product clearly, but keep proof close and claims modest.',
        headlineAngle: 'Demonstrate the workflow with proof beside it',
        proofPosture: 'balanced',
        visualBias: 'product',
        restraint: 'balanced',
        heroFraming: 'product-led',
        proofPlacement: 'mid',
        typographyMode: 'product',
        ctaStyle: 'solid',
        motionPolicy: 'subtle',
        ornamentAllowance: 'low',
        visualDensity: 'balanced',
        landingOrder: ['hero', 'features', 'stats', 'cta'],
        confidence: 0.74,
      },
    ],
    product: [
      {
        id: 'route-product-walkthrough',
        label: 'Product Walkthrough',
        summary: 'Show the workflow, then support it with the minimum proof needed to act.',
        headlineAngle: 'Open on what the product actually does',
        proofPosture: 'balanced',
        visualBias: 'product',
        restraint: 'balanced',
        heroFraming: 'product-led',
        proofPlacement: 'mid',
        typographyMode: 'product',
        ctaStyle: 'solid',
        motionPolicy: 'subtle',
        ornamentAllowance: 'low',
        visualDensity: 'balanced',
        landingOrder: ['hero', 'features', 'how-it-works', 'stats', 'cta'],
        confidence: 0.88,
      },
      {
        id: 'route-outcome-proof',
        label: 'Outcome Proof',
        summary: 'Lead with the user outcome, then back it up with proof and product context.',
        headlineAngle: 'Promise the result and prove it fast',
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
        landingOrder: ['hero', 'stats', 'features', 'testimonials', 'cta'],
        confidence: 0.79,
      },
      {
        id: 'route-editorial-story',
        label: 'Editorial Story',
        summary: 'Use a cleaner narrative arc and typographic emphasis to make the workflow memorable.',
        headlineAngle: 'Tell the before-and-after story of the workflow',
        proofPosture: 'light',
        visualBias: 'editorial',
        restraint: 'expressive',
        heroFraming: 'editorial-story',
        proofPlacement: 'late',
        typographyMode: 'editorial',
        ctaStyle: 'pill',
        motionPolicy: 'subtle',
        ornamentAllowance: 'medium',
        visualDensity: 'airy',
        landingOrder: ['hero', 'how-it-works', 'testimonial', 'cta'],
        confidence: 0.68,
      },
    ],
    editorial: [
      {
        id: 'route-narrative-opener',
        label: 'Narrative Opener',
        summary: 'Use a distinct, typographic story arc while keeping the proof explicit and readable.',
        headlineAngle: 'Start with the tension or change the actor feels',
        proofPosture: 'balanced',
        visualBias: 'editorial',
        restraint: 'expressive',
        heroFraming: 'editorial-story',
        proofPlacement: 'mid',
        typographyMode: 'editorial',
        ctaStyle: 'pill',
        motionPolicy: 'subtle',
        ornamentAllowance: 'medium',
        visualDensity: 'airy',
        landingOrder: ['hero', 'testimonial', 'features', 'cta'],
        confidence: 0.84,
      },
      {
        id: 'route-proof-led-editorial',
        label: 'Proof-Led Narrative',
        summary: 'Keep the editorial surface, but move proof up so it still sells and reassures.',
        headlineAngle: 'Blend story and credibility in the opening frame',
        proofPosture: 'heavy',
        visualBias: 'trust',
        restraint: 'balanced',
        heroFraming: 'proof-led',
        proofPlacement: 'hero',
        typographyMode: 'editorial',
        ctaStyle: 'outline',
        motionPolicy: 'none',
        ornamentAllowance: 'low',
        visualDensity: 'airy',
        landingOrder: ['hero', 'stats', 'testimonial', 'cta'],
        confidence: 0.79,
      },
      {
        id: 'route-minimal-brief',
        label: 'Minimal Brief',
        summary: 'Strip back ornament and use precise typography to keep the message sharp.',
        headlineAngle: 'Deliver the point with very little surface area',
        proofPosture: 'light',
        visualBias: 'conversion',
        restraint: 'strict',
        heroFraming: 'technical-brief',
        proofPlacement: 'late',
        typographyMode: 'editorial',
        ctaStyle: 'outline',
        motionPolicy: 'none',
        ornamentAllowance: 'none',
        visualDensity: 'compact',
        landingOrder: ['hero', 'features', 'cta'],
        confidence: 0.71,
      },
    ],
    technical: [
      {
        id: 'route-system-map',
        label: 'System Map',
        summary: 'Explain the system, workflow, or stack in a sharp, low-ornament way.',
        headlineAngle: 'Describe what the system does and where it fits',
        proofPosture: 'balanced',
        visualBias: 'technical',
        restraint: 'strict',
        heroFraming: 'technical-brief',
        proofPlacement: 'mid',
        typographyMode: 'technical',
        ctaStyle: 'outline',
        motionPolicy: 'none',
        ornamentAllowance: 'none',
        visualDensity: 'compact',
        landingOrder: ['hero', 'how-it-works', 'stats', 'cta'],
        confidence: 0.89,
      },
      {
        id: 'route-operator-proof',
        label: 'Operator Proof',
        summary: 'Focus on practical workflow value with concrete evidence and less brand theater.',
        headlineAngle: 'Show the practical win for the operator',
        proofPosture: 'heavy',
        visualBias: 'product',
        restraint: 'strict',
        heroFraming: 'product-led',
        proofPlacement: 'mid',
        typographyMode: 'technical',
        ctaStyle: 'solid',
        motionPolicy: 'none',
        ornamentAllowance: 'none',
        visualDensity: 'compact',
        landingOrder: ['hero', 'features', 'stats', 'cta'],
        confidence: 0.8,
      },
      {
        id: 'route-technical-brief',
        label: 'Technical Brief',
        summary: 'Use a concise, document-like rhythm for stakeholders who need clarity over gloss.',
        headlineAngle: 'Summarize the case in plain technical language',
        proofPosture: 'balanced',
        visualBias: 'trust',
        restraint: 'balanced',
        heroFraming: 'technical-brief',
        proofPlacement: 'hero',
        typographyMode: 'technical',
        ctaStyle: 'outline',
        motionPolicy: 'none',
        ornamentAllowance: 'low',
        visualDensity: 'compact',
        landingOrder: ['hero', 'faq', 'stats', 'cta'],
        confidence: 0.72,
      },
    ],
    conversion: [
      {
        id: 'route-direct-conversion',
        label: 'Direct Conversion',
        summary: 'Lead with the offer and remove friction to the next step.',
        headlineAngle: 'State the offer and why acting now is worth it',
        proofPosture: 'balanced',
        visualBias: 'conversion',
        restraint: 'balanced',
        heroFraming: 'direct-offer',
        proofPlacement: 'late',
        typographyMode: 'conversion',
        ctaStyle: 'solid',
        motionPolicy: 'subtle',
        ornamentAllowance: 'low',
        visualDensity: 'balanced',
        landingOrder: ['hero', 'features', 'cta'],
        confidence: 0.87,
      },
      {
        id: 'route-proof-backed-cta',
        label: 'Proof-Backed CTA',
        summary: 'Keep the conversion posture, but move a strong proof cue closer to the CTA.',
        headlineAngle: 'Promise the outcome, then validate it before the ask',
        proofPosture: 'heavy',
        visualBias: 'trust',
        restraint: 'strict',
        heroFraming: 'proof-led',
        proofPlacement: 'mid',
        typographyMode: 'conversion',
        ctaStyle: 'solid',
        motionPolicy: 'none',
        ornamentAllowance: 'none',
        visualDensity: 'balanced',
        landingOrder: ['hero', 'stats', 'features', 'cta'],
        confidence: 0.81,
      },
      {
        id: 'route-product-teaser',
        label: 'Product Teaser',
        summary: 'Let product clarity carry more weight while still keeping the flow action-oriented.',
        headlineAngle: 'Use one crisp product moment to earn the click',
        proofPosture: 'light',
        visualBias: 'product',
        restraint: 'balanced',
        heroFraming: 'product-led',
        proofPlacement: 'late',
        typographyMode: 'product',
        ctaStyle: 'pill',
        motionPolicy: 'subtle',
        ornamentAllowance: 'low',
        visualDensity: 'balanced',
        landingOrder: ['hero', 'features', 'cta'],
        confidence: 0.7,
      },
    ],
  }

  const routes = routesByDirection[input.direction]
  return routes.map((route) => ({
    ...route,
    summary: `${route.summary} Targeted at ${input.primaryActor.label.toLowerCase()} during ${input.decisionStage}.`,
  }))
}

function buildLandingSections(stage: DecisionStage): string[] {
  if (stage === 'discover') return ['hero', 'features', 'logos', 'cta']
  if (stage === 'justify') return ['hero', 'stats', 'testimonials', 'faq', 'cta']
  if (stage === 'convert') return ['hero', 'features', 'stats', 'cta']
  return ['hero', 'stats', 'features', 'testimonials', 'cta']
}

function buildDeckMoments(stage: DecisionStage): string[] {
  if (stage === 'justify') return ['title', 'problem', 'solution', 'proof', 'pricing', 'cta']
  if (stage === 'convert') return ['title', 'problem', 'solution', 'features', 'proof', 'cta']
  return ['title', 'problem', 'solution', 'features', 'proof', 'cta']
}

function buildProofRequirements(proofStrategy: ProofStrategy): string[] {
  switch (proofStrategy) {
    case 'product-proof':
      return ['Show the product or workflow', 'Anchor claims in specific usage detail']
    case 'customer-proof':
      return ['Use testimonial or customer outcome proof', 'Avoid unsupported superlatives']
    case 'evidence-stack':
      return ['Use metrics, supported claims, and named proof blocks', 'Make evidence easy to scan']
    case 'compliance-proof':
      return ['Use the safest approved claims only', 'Show compliance-safe proof and disclaimers when needed']
  }
}

function normalizePlanAssetTypes(assetTypes: string[] | undefined): PlanAssetType[] {
  const normalized = (assetTypes ?? ['landing-page', 'email', 'social', 'deck']).map((assetType) => {
    switch (assetType) {
      case 'landing':
      case 'landing_page':
      case 'landing-page':
        return 'landing-page'
      case 'email':
      case 'email_sequence':
        return 'email'
      case 'social':
      case 'social_post':
        return 'social'
      case 'deck':
      case 'sales_deck':
        return 'deck'
      default:
        return null
    }
  })

  return uniqueStrings(normalized.filter((value): value is PlanAssetType => value !== null))
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))]
}
