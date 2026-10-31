/**
 * Message Validators
 * 
 * Refactored to use the ClaimsOS rules engine for consistent validation
 * while maintaining backward compatibility with existing code.
 */

import {
  validateClaim,
  createDefaultPolicyContext,
  detectClaimCategory,
} from '@/lib/claims/rules-engine'
import type { PolicyConfig, ClaimValidationResult, ReasonCode } from '@/lib/claims/types'
import type { ForbiddenTerm } from '@/lib/supabase/types'

// ============================================================================
// Legacy Types (for backward compatibility)
// ============================================================================

export interface ValidationResult {
  status: 'approved' | 'needs_evidence' | 'blocked'
  riskTags: string[]
  strength: 'hard' | 'soft'
}

// ============================================================================
// Enhanced Validation Result
// ============================================================================

export interface EnhancedValidationResult extends ValidationResult {
  reasonCodes: ReasonCode[]
  riskScore: number
  category: string
  requiredEvidenceTier: 'A' | 'B' | 'C' | null
  suggestedRewrites?: string[]
}

// ============================================================================
// Conversion Helpers
// ============================================================================

/**
 * Convert forbidden phrases array to ForbiddenTerm format
 */
function toForbiddenTerms(phrases: string[]): ForbiddenTerm[] {
  return phrases.map(phrase => ({
    term: phrase,
    regex: false,
  }))
}

/**
 * Map ClaimsOS validation status to legacy status
 */
function mapStatus(status: ClaimValidationResult['status']): ValidationResult['status'] {
  switch (status) {
    case 'allowed':
      return 'approved'
    case 'needs_proof':
      return 'needs_evidence'
    case 'blocked':
      return 'blocked'
  }
}

/**
 * Convert reason codes to human-readable risk tags
 */
function reasonCodesToTags(codes: ReasonCode[]): string[] {
  const tagMap: Record<ReasonCode, string> = {
    SUPERLATIVE_NO_PROOF: 'Superlative',
    FORBIDDEN_TERM: 'Forbidden phrase',
    REGULATED_CATEGORY: 'Regulated category',
    QUANT_DELTA_NO_SOURCE: 'Unverified metric',
    COMPARATIVE_NO_BASELINE: 'Comparison',
    WEASEL_WORDS_STRICT: 'Ambiguous language',
    ABSOLUTE_CLAIM: 'Absolute claim',
    MISSING_EVIDENCE: 'Missing evidence',
  }
  
  return codes.map(code => tagMap[code] || code)
}

// ============================================================================
// Main Validation Functions
// ============================================================================

/**
 * Validate a message using the ClaimsOS rules engine
 * Maintains backward compatibility with existing code
 */
export function validateMessage(
  text: string,
  forbiddenPhrases: string[] = []
): ValidationResult {
  // Create policy context with forbidden phrases
  const context = createDefaultPolicyContext({
    forbiddenTerms: toForbiddenTerms(forbiddenPhrases),
  })
  
  // Run validation
  const result = validateClaim(text, context)
  
  // Determine strength based on claim type detection
  const strength: 'hard' | 'soft' = result.reasonCodes.length > 0 ? 'hard' : 'soft'
  
  const riskTags = reasonCodesToTags(result.reasonCodes)
  const forbiddenCount = result.reasonCodes.includes('FORBIDDEN_TERM')
    ? (result.triggeredTerms?.length || 1)
    : 0
  if (forbiddenCount > 1) {
    riskTags.push(...Array.from({ length: forbiddenCount - 1 }, () => 'Forbidden phrase'))
  }

  return {
    status: mapStatus(result.status),
    riskTags,
    strength,
  }
}

/**
 * Enhanced validation with full ClaimsOS result
 */
export function validateMessageEnhanced(
  text: string,
  policyOverrides?: Partial<PolicyConfig>,
  hasEvidence = false,
  evidenceTier?: 'A' | 'B' | 'C',
  linkedEvidenceCount = 0
): EnhancedValidationResult {
  const context = {
    policy: {
      ...createDefaultPolicyContext(policyOverrides).policy,
      ...policyOverrides,
    },
    hasEvidence,
    evidenceTier,
    linkedEvidenceCount,
  }
  
  const result = validateClaim(text, context)
  const category = detectClaimCategory(text)
  
  return {
    status: mapStatus(result.status),
    riskTags: reasonCodesToTags(result.reasonCodes),
    strength: result.reasonCodes.length > 0 ? 'hard' : 'soft',
    reasonCodes: result.reasonCodes,
    riskScore: result.riskScore,
    category,
    requiredEvidenceTier: result.requiredEvidenceTier,
    suggestedRewrites: result.suggestedRewrites,
  }
}

/**
 * Validate multiple messages at once
 */
export function validateAllMessages(
  messages: string[],
  forbiddenPhrases: string[] = []
): Map<string, ValidationResult> {
  const results = new Map<string, ValidationResult>()
  
  for (const message of messages) {
    results.set(message, validateMessage(message, forbiddenPhrases))
  }
  
  return results
}

/**
 * Validate multiple messages with enhanced results
 */
export function validateAllMessagesEnhanced(
  messages: string[],
  policyOverrides?: Partial<PolicyConfig>
): Map<string, EnhancedValidationResult> {
  const results = new Map<string, EnhancedValidationResult>()
  
  for (const message of messages) {
    results.set(message, validateMessageEnhanced(message, policyOverrides))
  }
  
  return results
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Quick check if a message would be blocked
 */
export function isMessageBlocked(
  text: string,
  forbiddenPhrases: string[] = []
): boolean {
  const result = validateMessage(text, forbiddenPhrases)
  return result.status === 'blocked'
}

/**
 * Get all risk factors for a message
 */
export function getMessageRiskFactors(
  text: string,
  policyOverrides?: Partial<PolicyConfig>
): {
  factors: string[]
  score: number
  blocked: boolean
  needsEvidence: boolean
} {
  const result = validateMessageEnhanced(text, policyOverrides)
  
  return {
    factors: result.riskTags,
    score: result.riskScore,
    blocked: result.status === 'blocked',
    needsEvidence: result.status === 'needs_evidence',
  }
}
