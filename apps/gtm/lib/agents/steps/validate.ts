import { createServiceClient } from '@/lib/supabase/service'
import { validateClaims, parsePolicyFromDatabase, createDefaultPolicyContext } from '@/lib/claims/rules-engine'
import type { AgentState, StepResult, ClaimValidationResult } from '../state'

export async function validateClaimsStep(state: AgentState): Promise<Partial<AgentState>> {
  const startTime = Date.now()

  if (!state.pageBlocks || state.pageBlocks.length === 0) {
    return {
      currentStep: 'error',
      error: 'No page blocks to validate',
    }
  }

  const supabase = createServiceClient()

  // Get workspace policy
  const { data: policy } = await supabase
    .from('policies')
    .select('*')
    .eq('workspace_id', state.workspaceId)
    .order('version', { ascending: false })
    .limit(1)
    .single()

  const policyConfig = policy ? parsePolicyFromDatabase(policy) : createDefaultPolicyContext().policy

  // Extract all text content from blocks
  const claimsToValidate: { id: string; text: string }[] = []

  state.pageBlocks.forEach((block, blockIndex) => {
    const props = block.props as Record<string, unknown>

    // Extract text from common props
    const textProps = ['headline', 'subheadline', 'title', 'description', 'cta_text', 'body']
    textProps.forEach((prop) => {
      if (typeof props[prop] === 'string' && props[prop]) {
        claimsToValidate.push({
          id: `${blockIndex}-${prop}`,
          text: props[prop] as string,
        })
      }
    })

    // Extract from arrays (benefits, features, etc.)
    if (Array.isArray(props.items)) {
      props.items.forEach((item: unknown, itemIndex: number) => {
        if (typeof item === 'object' && item !== null) {
          const itemObj = item as Record<string, unknown>
          if (typeof itemObj.title === 'string') {
            claimsToValidate.push({
              id: `${blockIndex}-item-${itemIndex}-title`,
              text: itemObj.title,
            })
          }
          if (typeof itemObj.description === 'string') {
            claimsToValidate.push({
              id: `${blockIndex}-item-${itemIndex}-desc`,
              text: itemObj.description,
            })
          }
        }
      })
    }
  })

  // Run validation
  const validationContext = {
    policy: policyConfig,
    hasEvidence: false,
    linkedEvidenceCount: 0,
  }

  const validationResults = validateClaims(claimsToValidate, validationContext)

  // Convert to our format (map 'allowed' to 'approved')
  const claimResults: ClaimValidationResult[] = Array.from(validationResults.entries()).map(
    ([id, result]) => ({
      id,
      text: claimsToValidate.find((c) => c.id === id)?.text || '',
      status: result.status === 'allowed' ? 'approved' : result.status,
      riskScore: result.riskScore,
      reasonCodes: result.reasonCodes as string[],
    })
  )

  // Calculate overall trust score
  const avgRiskScore = claimResults.length > 0
    ? claimResults.reduce((sum, r) => sum + r.riskScore, 0) / claimResults.length
    : 0
  const trustScore = Math.max(0, 100 - avgRiskScore)

  // Determine next step
  const blockedClaims = claimResults.filter((r) => r.status === 'blocked')
  const needsReview = trustScore < 60 || blockedClaims.length > 0

  let nextStep: AgentState['currentStep'] = 'deploy'

  if (needsReview && !state.skipReview) {
    if (state.autoFix && state.iterationCount < 3) {
      nextStep = 'auto_fix'
    } else {
      nextStep = 'waiting_approval'
    }
  }

  const stepResult: StepResult = {
    step: 'validate_claims',
    result: {
      totalClaims: claimResults.length,
      blocked: blockedClaims.length,
      trustScore,
      needsReview,
    },
    timestamp: new Date(),
    durationMs: Date.now() - startTime,
  }

  return {
    claimResults,
    trustScore,
    needsReview,
    currentStep: nextStep,
    stepHistory: [...state.stepHistory, stepResult],
    iterationCount: state.iterationCount + 1,
  }
}
