/**
 * ClaimsOS Type Definitions
 * 
 * Core types for the claims governance system including validation results,
 * reason codes, and policy configurations.
 */

import type {
  ClaimType,
  ClaimCategory,
  ClaimStatus,
  EvidenceTier,
  ReasonCode,
  PolicyMode,
  ForbiddenTerm,
  RegulatedCategories,
  SuperlativeRules,
  EvidenceRequirements,
} from '@/lib/supabase/types'

// ============================================================================
// Validation Result Types
// ============================================================================

export interface ClaimValidationResult {
  /** Overall validation status */
  status: 'allowed' | 'needs_proof' | 'blocked'
  
  /** Reason codes explaining why claim was flagged */
  reasonCodes: ReasonCode[]
  
  /** Required evidence tier to unlock claim (if needs_proof) */
  requiredEvidenceTier: EvidenceTier | null
  
  /** Risk score 0-100 based on validation findings */
  riskScore: number
  
  /** AI-suggested compliant rewrites */
  suggestedRewrites?: string[]
  
  /** Specific terms that triggered the validation */
  triggeredTerms?: string[]
  
  /** Category detected from claim content */
  detectedCategory?: ClaimCategory
}

// ============================================================================
// Policy Types
// ============================================================================

export interface PolicyConfig {
  mode: PolicyMode
  forbiddenTerms: ForbiddenTerm[]
  regulatedCategories: RegulatedCategories
  superlativeRules: SuperlativeRules
  evidenceRequirements: EvidenceRequirements
}

export interface PolicyValidationContext {
  policy: PolicyConfig
  hasEvidence: boolean
  evidenceTier?: EvidenceTier
  linkedEvidenceCount: number
}

// ============================================================================
// Claim Candidate (for generation)
// ============================================================================

export interface ClaimCandidate {
  text: string
  claimType: ClaimType
  category: ClaimCategory
  confidence: number
  sourceContext?: string
}

// ============================================================================
// Rule Definitions
// ============================================================================

export interface RuleDefinition {
  id: string
  name: string
  description: string
  check: (text: string, context: PolicyValidationContext) => RuleCheckResult
}

export interface RuleCheckResult {
  passed: boolean
  reasonCode?: ReasonCode
  message?: string
  triggeredTerms?: string[]
  requiredAction?: 'block' | 'needs_proof' | 'warn'
  requiredEvidenceTier?: EvidenceTier
}

// ============================================================================
// Superlative and Pattern Definitions
// ============================================================================

export const SUPERLATIVES = [
  'best',
  'most',
  '#1',
  'number one',
  'only',
  'first',
  'fastest',
  'leading',
  'top',
  'industry-leading',
  'world-class',
  'unmatched',
  'unparalleled',
  'ultimate',
  'premier',
  'superior',
] as const

export const ABSOLUTE_TERMS = [
  'always',
  'never',
  'guaranteed',
  'guarantee',
  'forever',
  'unlimited',
  'complete',
  'total',
  'absolute',
  'perfect',
  '100%',
] as const

export const COMPARATIVE_PATTERNS = [
  /(\d+)%\s*(faster|better|more|less|cheaper|higher|lower)/i,
  /(\d+)x\s*(faster|better|more)/i,
  /up\s+to\s+(\d+)/i,
  /(save|saves|saved)\s+(you\s+)?(\d+)%/i,
  /increase(?:\s+\w+){0,3}\s+by\s+(\d+)%/i,
  /increase\s+(\d+)%/i,
  /(\d+)%\s+(increase|improvement|reduction|faster)/i,
  /reduce\s+(\d+)%/i,
  /(\d+)\s*times\s*(faster|better|more)/i,
] as const

export const WEASEL_WORDS = [
  'up to',
  'as much as',
  'can',
  'may',
  'might',
  'could',
  'potentially',
  'possibly',
  'virtually',
  'nearly',
  'almost',
] as const

export const REGULATED_KEYWORDS: Record<keyof RegulatedCategories, string[]> = {
  security: [
    'secure',
    'encrypted',
    'protected',
    'compliant',
    'SOC',
    'SOC2',
    'SOC 2',
    'zero-trust',
    'ISO',
    'GDPR',
    'PCI',
    'vulnerability',
    'penetration',
    'audit',
    'certified',
  ],
  health: [
    'FDA',
    'HIPAA',
    'clinical',
    'medical',
    'treatment',
    'cure',
    'diagnosis',
    'therapeutic',
    'health',
    'wellness',
    'prescription',
  ],
  finance: [
    'investment',
    'returns',
    'profit',
    'earnings',
    'ROI',
    'financial',
    'savings',
    'revenue',
    'SEC',
    'FINRA',
  ],
  legal: [
    'legal',
    'liability',
    'lawsuit',
    'attorney',
    'compliance',
    'regulation',
    'regulatory',
    'contract',
    'binding',
  ],
}

// ============================================================================
// Audit Event Types
// ============================================================================

export interface AuditEvent {
  entityType: 'claim' | 'evidence' | 'policy' | 'approval' | 'claim_pack'
  entityId: string
  action: 'create' | 'update' | 'delete' | 'approve' | 'reject' | 'link' | 'unlink' | 'export'
  before?: Record<string, unknown>
  after?: Record<string, unknown>
  actorId?: string
  timestamp: Date
}

// ============================================================================
// LangGraph State Types (for Phase 4)
// ============================================================================

export interface ClaimGraphState {
  // Input
  policy: PolicyConfig
  evidenceSummaries: string[]
  campaignContext: {
    audience?: string
    goal?: string
    offer?: string
    industry?: string
  }
  
  // Processing
  claimCandidates: ClaimCandidate[]
  validationResults: ClaimValidationResult[]
  retryCount: number
  
  // Output
  finalClaims: Array<{
    text: string
    type: ClaimType
    category: ClaimCategory
    status: ClaimStatus
    reasonCodes: ReasonCode[]
    riskScore: number
    requiredEvidenceTier: EvidenceTier | null
    suggestedRewrites: string[]
  }>
  
  // Audit
  auditEvents: AuditEvent[]
}

// ============================================================================
// Export for re-use
// ============================================================================

export type {
  ClaimType,
  ClaimCategory,
  ClaimStatus,
  EvidenceTier,
  ReasonCode,
  PolicyMode,
  ForbiddenTerm,
  RegulatedCategories,
  SuperlativeRules,
  EvidenceRequirements,
}
