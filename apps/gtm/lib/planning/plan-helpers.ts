import type {
  CreativeRoute,
  GenerationPlan,
  PlanAssetType,
  ReviewActionId,
} from './types'

export function applyReviewActionToPlan(plan: GenerationPlan, action: ReviewActionId): GenerationPlan {
  const updated = structuredClone(plan)

  switch (action) {
    case 'make-product-clearer':
      updated.selectedRoute = pickRouteByBias(updated, 'product')
      ensureBlueprintRequirement(updated, 'landing-page', 'features')
      ensureBlueprintProof(updated, 'landing-page', 'Show the product before asking for the CTA')
      break
    case 'increase-proof':
      updated.proofStrategy =
        updated.proofStrategy === 'compliance-proof' ? 'compliance-proof' : 'evidence-stack'
      updated.selectedRoute = pickHeaviestProofRoute(updated)
      updated.constraints.proofBlockers = uniqueStrings([
        'Include at least one supported metric, customer proof point, or compliance-safe validation cue',
        ...updated.constraints.proofBlockers,
      ])
      break
    case 'reduce-ornament':
      updated.constraints.visualBans = uniqueStrings([
        'Reduce decorative surfaces and keep the layout visually plain',
        ...updated.constraints.visualBans,
      ])
      updated.selectedRoute = pickStrictestRoute(updated)
      break
    case 'tighten-hierarchy':
      updated.constraints.mustInclude = uniqueStrings([
        'A single dominant headline and one obvious next step',
        ...updated.constraints.mustInclude,
      ])
      break
    case 'shift-trust':
      updated.selectedRoute = pickRouteByBias(updated, 'trust')
      updated.proofStrategy = updated.proofStrategy === 'product-proof' ? 'evidence-stack' : updated.proofStrategy
      break
    case 'shift-product':
      updated.selectedRoute = pickRouteByBias(updated, 'product')
      break
    case 'shift-editorial':
      updated.selectedRoute = pickRouteByBias(updated, 'editorial')
      break
    case 'shift-technical':
      updated.selectedRoute = pickRouteByBias(updated, 'technical')
      break
    case 'shift-conversion':
      updated.selectedRoute = pickRouteByBias(updated, 'conversion')
      break
  }

  return updated
}

export function getSelectedCreativeRoute(plan: GenerationPlan): CreativeRoute {
  return (
    plan.creativeRoutes.find((route) => route.id === plan.selectedRoute) ??
    plan.creativeRoutes[0]
  )
}

function pickRouteByBias(
  plan: GenerationPlan,
  bias: CreativeRoute['visualBias'],
): string {
  return (
    plan.creativeRoutes.find((route) => route.visualBias === bias)?.id ??
    plan.selectedRoute
  )
}

function pickHeaviestProofRoute(plan: GenerationPlan): string {
  return (
    plan.creativeRoutes
      .slice()
      .sort((left, right) => proofWeight(right.proofPosture) - proofWeight(left.proofPosture))[0]?.id ??
    plan.selectedRoute
  )
}

function pickStrictestRoute(plan: GenerationPlan): string {
  return (
    plan.creativeRoutes
      .slice()
      .sort((left, right) => restraintWeight(left.restraint) - restraintWeight(right.restraint))[0]?.id ??
    plan.selectedRoute
  )
}

function ensureBlueprintRequirement(plan: GenerationPlan, assetType: PlanAssetType, requirement: string): void {
  const blueprint = plan.assetBlueprints.find((entry) => entry.assetType === assetType)
  if (blueprint) {
    blueprint.requiredSections = uniqueStrings([...blueprint.requiredSections, requirement])
  }
}

function ensureBlueprintProof(plan: GenerationPlan, assetType: PlanAssetType, requirement: string): void {
  const blueprint = plan.assetBlueprints.find((entry) => entry.assetType === assetType)
  if (blueprint) {
    blueprint.proofRequirements = uniqueStrings([...blueprint.proofRequirements, requirement])
  }
}

function proofWeight(posture: CreativeRoute['proofPosture']): number {
  return posture === 'heavy' ? 3 : posture === 'balanced' ? 2 : 1
}

function restraintWeight(restraint: CreativeRoute['restraint']): number {
  return restraint === 'strict' ? 1 : restraint === 'balanced' ? 2 : 3
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))]
}
