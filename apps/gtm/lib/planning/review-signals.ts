import type { GenerationPlan, ReviewActionId, ReviewSignal } from './types'
import { evaluateAssetOutput } from './output-evaluator'

export function buildReviewSignals(
  assetType: 'landing-page' | 'email' | 'social' | 'deck',
  content: string,
  plan: GenerationPlan,
): ReviewSignal[] {
  const evaluation = evaluateAssetOutput(assetType, content, plan)
  const {
    distinctiveness,
    brandFit,
    proofCoverage,
    actorFit,
    hierarchyClarity,
    restraint,
    routeFidelity,
    channelFit,
  } = evaluation.scores

  return [
    {
      key: 'brandFit',
      label: 'Brand Fit',
      score: brandFit,
      summary: brandFit >= 75 ? 'Feels consistent with the chosen route and brand context.' : 'Still reads generic relative to the selected route.',
    },
    {
      key: 'restraint',
      label: 'Restraint',
      score: restraint,
      summary: restraint >= 75 ? 'Ornament stays subordinate to clarity and proof.' : 'Visual or copy choices feel noisier than they should.',
    },
    {
      key: 'proofCoverage',
      label: 'Proof Coverage',
      score: proofCoverage,
      summary: proofCoverage >= 75 ? 'The output carries enough support for the decision stage.' : 'It needs more concrete proof for the current buying stage.',
    },
    {
      key: 'actorFit',
      label: 'Actor Fit',
      score: actorFit,
      summary: actorFit >= 75 ? 'It speaks to the right actor and their concerns.' : 'The message is not specific enough for the intended actor.',
    },
    {
      key: 'channelFit',
      label: 'Channel Fit',
      score: channelFit,
      summary: channelFit >= 75 ? 'The format matches the channel expectations.' : 'The structure needs more channel-specific discipline.',
    },
    {
      key: 'distinctiveness',
      label: 'Distinctiveness',
      score: distinctiveness,
      summary: distinctiveness >= 75 ? 'The framing feels chosen, not defaulted.' : 'The asset still feels too close to generic AI output.',
    },
    {
      key: 'routeFidelity',
      label: 'Route Fidelity',
      score: routeFidelity,
      summary: routeFidelity >= 75 ? 'The asset follows the selected route in structure and emphasis.' : 'The output is drifting away from the selected route.',
    },
    {
      key: 'hierarchyClarity',
      label: 'Hierarchy',
      score: hierarchyClarity,
      summary: hierarchyClarity >= 75 ? 'The primary message and next action are easy to parse.' : 'The message hierarchy needs tightening.',
    },
  ]
}

export function recommendReviewActions(signals: ReviewSignal[]): ReviewActionId[] {
  const actions: ReviewActionId[] = []

  const lookup = Object.fromEntries(signals.map((signal) => [signal.key, signal.score])) as Record<ReviewSignal['key'], number>

  if (lookup.proofCoverage < 75) actions.push('increase-proof')
  if (lookup.restraint < 75) actions.push('reduce-ornament')
  if (lookup.hierarchyClarity < 75 || lookup.actorFit < 75) actions.push('tighten-hierarchy')
  if (lookup.brandFit < 75) actions.push('make-product-clearer')
  if (lookup.routeFidelity < 75) actions.push('shift-technical')
  if (lookup.distinctiveness < 70) actions.push('shift-editorial')

  return [...new Set(actions)].slice(0, 3)
}
