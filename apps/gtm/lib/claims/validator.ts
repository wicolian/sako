/**
 * Claim Validator
 * 
 * Convenience wrapper around the rules engine for external consumers.
 * Re-exports validateClaim with a simpler interface for Slack commands etc.
 */

import { validateClaim as validateClaimCore, createDefaultPolicyContext } from './rules-engine'
import type { ClaimValidationResult, PolicyValidationContext } from './types'

export interface ClaimValidationOutput {
  status: 'valid' | 'needs_evidence' | 'flagged' | 'pending'
  confidence: number
  issues: string[]
  riskScore: number
}

/**
 * Validate a claim text against workspace policy
 * Uses default policy context for simplicity
 */
export async function validateClaim(
  claimText: string,
  _workspaceId: string
): Promise<ClaimValidationOutput> {
  // Use default policy context for now
  // In production, this should fetch the workspace policy
  const policyContext: PolicyValidationContext = createDefaultPolicyContext()

  // Run validation
  const result: ClaimValidationResult = validateClaimCore(claimText, policyContext)

  // Map to output format
  let status: ClaimValidationOutput['status']
  switch (result.status) {
    case 'allowed':
      status = 'valid'
      break
    case 'needs_proof':
      status = 'needs_evidence'
      break
    case 'blocked':
      status = 'flagged'
      break
    default:
      status = 'pending'
  }

  // Calculate confidence (inverse of risk)
  const confidence = Math.max(0, (100 - result.riskScore) / 100)

  // Build issues list from reason codes
  const issues = result.reasonCodes.map(code => {
    switch (code) {
      case 'SUPERLATIVE_NO_PROOF':
        return 'Contains superlative claim without proof'
      case 'ABSOLUTE_CLAIM':
        return 'Makes absolute/unqualified claim'
      case 'COMPARATIVE_NO_BASELINE':
        return 'Comparative claim requires baseline'
      case 'FORBIDDEN_TERM':
        return 'Contains forbidden terminology'
      case 'REGULATED_CATEGORY':
        return 'Touches on regulated category'
      case 'WEASEL_WORDS_STRICT':
        return 'Contains vague/weasel words'
      case 'QUANT_DELTA_NO_SOURCE':
        return 'Quantified claim needs source'
      case 'MISSING_EVIDENCE':
        return 'Missing required evidence'
      default:
        return code
    }
  })

  return {
    status,
    confidence,
    issues,
    riskScore: result.riskScore,
  }
}
