import { detectSlop } from '@/lib/ai/anti-slop'
import { scoreDesignQuality } from '@/lib/templates/visual-qa'
import type {
  GenerationPlan,
  OutputEvaluation,
  OutputEvaluationIssue,
  OutputEvaluationIssueCode,
  PlanAssetType,
  ReviewActionId,
} from './types'
import { getSelectedCreativeRoute } from './generation-plan'

interface EvaluateOutputOptions {
  existingContent?: string
}

export function evaluateAssetOutput(
  assetType: PlanAssetType,
  content: string,
  plan: GenerationPlan,
  options: EvaluateOutputOptions = {},
): OutputEvaluation {
  const text = stripHtml(content)
  const route = getSelectedCreativeRoute(plan)
  const visualScore = assetType === 'landing-page' ? scoreDesignQuality(content) : null
  const issues: OutputEvaluationIssue[] = []
  const strengths: string[] = []

  const slopIssues = detectSlopPatterns(content, text)
  issues.push(...slopIssues)

  const distinctiveness = clampScore(84 - slopIssues.length * 10 - detectSlop(text).length * 8)
  const brandFit = clampScore(
    (visualScore ? Math.round(visualScore.dimensions.brandFit * 100) : 78) -
      countIssues(slopIssues, ['purple_gradient_default', 'fake_dashboard_chrome', 'generic_filler_copy']) * 8,
  )
  const proofCoverage = clampScore(scoreProofCoverage(text, plan, issues))
  const actorFit = clampScore(scoreActorFit(text, plan, issues))
  const hierarchyClarity = clampScore(scoreHierarchyClarity(assetType, content, text, issues))
  const restraint = clampScore(
    (visualScore ? Math.round(visualScore.dimensions.restraint * 100) : 80) -
      countIssues(slopIssues, ['decorative_motion', 'hover_gimmick', 'glassmorphism_overuse', 'accent_color_scatter']) * 10,
  )
  const routeFidelity = clampScore(scoreRouteFidelity(assetType, content, text, plan, issues))
  const channelFit = clampScore(scoreChannelFit(assetType, text, issues))

  if (proofCoverage >= 80) strengths.push('Proof is concrete enough for the current decision stage.')
  if (actorFit >= 80) strengths.push('The asset speaks to the chosen actor and their concerns.')
  if (restraint >= 80) strengths.push('Visual treatment stays subordinate to clarity.')
  if (routeFidelity >= 80) strengths.push(`The output follows the selected ${route.label} route.`)
  if (hierarchyClarity >= 80) strengths.push('The hierarchy makes the next action obvious.')

  const preserve = buildPreserveList(assetType, content, plan, {
    distinctiveness,
    brandFit,
    proofCoverage,
    actorFit,
    hierarchyClarity,
    restraint,
    routeFidelity,
    channelFit,
  }, options.existingContent)

  return {
    assetType,
    scores: {
      distinctiveness,
      brandFit,
      proofCoverage,
      actorFit,
      hierarchyClarity,
      restraint,
      routeFidelity,
      channelFit,
    },
    issues,
    strengths,
    preserve,
    suggestedActions: suggestActions({
      distinctiveness,
      brandFit,
      proofCoverage,
      actorFit,
      hierarchyClarity,
      restraint,
      routeFidelity,
      channelFit,
    }),
  }
}

export function buildSurgicalRegenerationContext(
  assetType: PlanAssetType,
  evaluation: OutputEvaluation,
  reviewAction: ReviewActionId | undefined,
  existingContent: string | null,
): string {
  const issueSummary = evaluation.issues
    .slice(0, 6)
    .map((issue) => `- [${issue.code}] ${issue.message}`)
    .join('\n')

  const preserveSummary = evaluation.preserve.map((item) => `- ${item}`).join('\n')

  return [
    'IMPROVEMENT BRIEF:',
    reviewAction ? `Requested action: ${reviewAction}` : '',
    evaluation.strengths.length > 0 ? `Preserve strengths:\n${evaluation.strengths.map((item) => `- ${item}`).join('\n')}` : '',
    preserveSummary ? `Do not rewrite these unless absolutely necessary:\n${preserveSummary}` : '',
    issueSummary ? `Issues to fix:\n${issueSummary}` : '',
    existingContent
      ? `Current asset reference:\n${truncateForPrompt(stripHtml(existingContent), assetType === 'landing-page' ? 2500 : 1600)}`
      : '',
  ]
    .filter(Boolean)
    .join('\n\n')
}

function detectSlopPatterns(content: string, text: string): OutputEvaluationIssue[] {
  const issues: OutputEvaluationIssue[] = []

  pushIf(issues, /(6366f1|8b5cf6|a855f7|9333ea)/i.test(content) && /linear-gradient/i.test(content), {
    code: 'purple_gradient_default',
    severity: 'warning',
    message: 'The asset leans on generic purple-gradient SaaS styling.',
  })

  pushIf(issues, /(rounded-full bg-red-500|browser|window controls|fake browser|dashboard chrome)/i.test(content), {
    code: 'fake_dashboard_chrome',
    severity: 'warning',
    message: 'The asset uses fake browser or dashboard chrome instead of real proof.',
  })

  pushIf(issues, /(animation|transition|stagger|parallax|scroll)/i.test(content) && /(animate|transition)/i.test(content), {
    code: 'decorative_motion',
    severity: 'info',
    message: 'Motion appears present; verify that it supports comprehension instead of decoration.',
  })

  pushIf(issues, /hover[^}]*scale|hover[^}]*translate|group-hover/i.test(content), {
    code: 'hover_gimmick',
    severity: 'warning',
    message: 'Hover motion is doing too much work for the interaction.',
  })

  pushIf(issues, /backdrop-filter|glass|blur\(/i.test(content), {
    code: 'glassmorphism_overuse',
    severity: 'warning',
    message: 'Glassmorphism or blur surfaces are crowding the design.',
  })

  pushIf(issues, countDistinctHexColors(content) >= 5, {
    code: 'accent_color_scatter',
    severity: 'warning',
    message: 'Too many unrelated accent colors are competing for attention.',
  })

  pushIf(issues, /(launch faster|modern teams|world-class|best-in-class|cutting-edge|next generation|seamless|powerful platform)/i.test(text), {
    code: 'generic_filler_copy',
    severity: 'warning',
    message: 'The copy contains generic filler instead of distinct, supportable language.',
  })

  pushIf(issues, /(features & benefits|trusted by|what you'll get|all in one place)/i.test(text), {
    code: 'templated_section_stack',
    severity: 'info',
    message: 'Section framing looks templated rather than chosen for this route.',
  })

  pushIf(issues, /(text-slate-400|text-gray-400|text-muted-foreground)/i.test(content) && /(bg-card|#ffffff)/i.test(content), {
    code: 'weak_contrast',
    severity: 'warning',
    message: 'Low-contrast text treatment is likely weakening hierarchy and readability.',
  })

  return issues
}

function scoreProofCoverage(text: string, plan: GenerationPlan, issues: OutputEvaluationIssue[]): number {
  let score = 35

  if (/\b(customer|case study|testimonial|proof|metric|result|roi|evidence|approved|compliant|reviewed)\b/i.test(text)) {
    score += 30
  }

  if (/\b\d+(?:\.\d+)?%|\b\d+(?:\.\d+)?x\b|\b\d+(?:\.\d+)?\s(?:days|hours|teams|customers|users)\b/i.test(text)) {
    score += 20
  }

  if (plan.proofStrategy === 'product-proof' && /\b(product|workflow|demo|steps|screen|feature)\b/i.test(text)) {
    score += 15
  }

  if (score < 75) {
    issues.push({
      code: 'weak_proof',
      severity: 'warning',
      message: 'The asset does not carry enough proof for the selected decision stage.',
      detail: `Expected strategy: ${plan.proofStrategy}`,
    })
  }

  return score
}

function scoreActorFit(text: string, plan: GenerationPlan, issues: OutputEvaluationIssue[]): number {
  let score = 40
  const actorLabel = plan.primaryActor.label.toLowerCase()

  if (actorLabel.length > 0 && text.toLowerCase().includes(actorLabel.split(' ')[0])) {
    score += 25
  }

  const matchedConcerns = plan.primaryActor.concerns.filter((concern) =>
    text.toLowerCase().includes(concern.toLowerCase().split(' ')[0]),
  ).length
  score += matchedConcerns * 10

  if (plan.decisionStage === 'convert' && /\b(start|get started|book|request|cta|demo)\b/i.test(text)) {
    score += 15
  }

  if (score < 70) {
    issues.push({
      code: 'actor_mismatch',
      severity: 'warning',
      message: 'The asset is not specific enough for the intended actor.',
      detail: `Primary actor: ${plan.primaryActor.label}`,
    })
  }

  return score
}

function scoreHierarchyClarity(
  assetType: PlanAssetType,
  content: string,
  text: string,
  issues: OutputEvaluationIssue[],
): number {
  let score = 55

  if (assetType === 'landing-page') {
    if (/<h1/i.test(content)) score += 20
    if (/<a[^>]*cta-button|<button/i.test(content)) score += 15
    if ((text.match(/\b(get started|book demo|learn more|start free|request demo)\b/gi) ?? []).length <= 2) score += 10
  } else {
    if (/\b(subject|preheader|cta|book|reply|demo)\b/i.test(text)) score += 15
    if (text.length < 1600) score += 10
  }

  if (score < 75) {
    issues.push({
      code: 'weak_hierarchy',
      severity: 'warning',
      message: 'The hierarchy does not make the primary next action obvious.',
    })
  }

  return score
}

function scoreRouteFidelity(
  assetType: PlanAssetType,
  content: string,
  text: string,
  plan: GenerationPlan,
  issues: OutputEvaluationIssue[],
): number {
  const route = getSelectedCreativeRoute(plan)
  let score = 50

  if (text.toLowerCase().includes(route.headlineAngle.toLowerCase().split(' ')[0])) {
    score += 10
  }

  if (route.proofPosture === 'heavy' && /\b(proof|evidence|metric|customer|case study|reviewed|approved)\b/i.test(text)) {
    score += 15
  }

  if (route.heroFraming === 'proof-led' && /\b(reviewable|evidence|proof|audit|approved|security)\b/i.test(text)) {
    score += 15
  }

  if (route.heroFraming === 'product-led' && /\b(product|workflow|demo|steps|feature|screen)\b/i.test(text)) {
    score += 15
  }

  if (route.heroFraming === 'technical-brief' && /\b(system|architecture|infrastructure|operator|technical|api)\b/i.test(text)) {
    score += 15
  }

  if (route.heroFraming === 'editorial-story' && /\b(story|before|after|change|narrative)\b/i.test(text)) {
    score += 15
  }

  if (route.visualBias === 'technical' && /\b(system|workflow|api|infrastructure|technical|operator)\b/i.test(text)) {
    score += 15
  }

  if (route.visualBias === 'editorial' && /\b(story|narrative|change|before|after)\b/i.test(text)) {
    score += 15
  }

  if (route.visualBias === 'conversion' && /\b(start|get started|book|request|trial|demo)\b/i.test(text)) {
    score += 15
  }

  const blueprint = plan.assetBlueprints.find((entry) => entry.assetType === assetType)
  if (blueprint) {
    const matchedMoments = blueprint.requiredSections.filter((entry) => text.toLowerCase().includes(entry.toLowerCase().split('-')[0])).length
    score += matchedMoments * 4
  }

  if (score < 75) {
    issues.push({
      code: 'route_mismatch',
      severity: 'warning',
      message: 'The asset is drifting away from the selected creative route.',
      detail: `Expected route: ${route.label}`,
    })
  }

  return score
}

function scoreChannelFit(assetType: PlanAssetType, text: string, issues: OutputEvaluationIssue[]): number {
  let score: number

  switch (assetType) {
    case 'landing-page':
      score = /\bcta|feature|proof|faq|hero\b/i.test(text) ? 82 : 68
      break
    case 'email':
      score = /\bsubject|preheader|email|reply|cta\b/i.test(text) ? 84 : 70
      break
    case 'social':
      score = text.length <= 1800 ? 82 : 65
      break
    case 'deck':
      score = /\bslide|speaker|proof|cta|pricing\b/i.test(text) ? 84 : 70
      break
  }

  if (score < 75) {
    issues.push({
      code: 'channel_mismatch',
      severity: 'info',
      message: 'The asset structure does not fully match the expected channel shape.',
    })
  }

  return score
}

function buildPreserveList(
  assetType: PlanAssetType,
  content: string,
  plan: GenerationPlan,
  scores: OutputEvaluation['scores'],
  existingContent?: string,
): string[] {
  const preserve: string[] = []

  if (scores.routeFidelity >= 75) {
    preserve.push(`Keep the selected ${getSelectedCreativeRoute(plan).label} route intact`)
  }

  if (scores.brandFit >= 75) {
    preserve.push('Preserve brand tokens, type choices, and tone cues that already fit')
  }

  if (scores.hierarchyClarity >= 75) {
    preserve.push('Preserve the current headline/CTA hierarchy')
  }

  if (scores.proofCoverage >= 75) {
    preserve.push('Preserve the existing proof blocks and approved claims where possible')
  }

  if (assetType === 'landing-page' && /<section class="hero"/i.test(content)) {
    preserve.push('Do not rewrite the hero unless the requested action directly requires it')
  }

  if (existingContent && stripHtml(existingContent) === stripHtml(content)) {
    preserve.push('Use the current asset as the structural baseline and edit surgically')
  }

  return preserve
}

function suggestActions(scores: OutputEvaluation['scores']): string[] {
  const actions: string[] = []

  if (scores.proofCoverage < 75) actions.push('increase-proof')
  if (scores.restraint < 75) actions.push('reduce-ornament')
  if (scores.hierarchyClarity < 75) actions.push('tighten-hierarchy')
  if (scores.routeFidelity < 75) actions.push('make-product-clearer')
  if (scores.actorFit < 75) actions.push('shift-technical')

  return [...new Set(actions)].slice(0, 4)
}

function countDistinctHexColors(content: string): number {
  return new Set((content.match(/#[0-9a-f]{6}/gi) ?? []).map((value) => value.toLowerCase())).size
}

function countIssues(
  issues: OutputEvaluationIssue[],
  codes: OutputEvaluationIssueCode[],
): number {
  return issues.filter((issue) => codes.includes(issue.code)).length
}

function truncateForPrompt(text: string, limit: number): string {
  return text.length <= limit ? text : `${text.slice(0, limit)}…`
}

function stripHtml(input: string): string {
  return input.replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function pushIf(target: OutputEvaluationIssue[], condition: boolean, issue: OutputEvaluationIssue): void {
  if (condition) {
    target.push(issue)
  }
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)))
}
