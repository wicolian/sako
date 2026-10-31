/**
 * ClaimsOS Rules Engine
 * 
 * A pure-function rules engine that validates claims against workspace policies.
 * This is deterministic - no AI involved. The rules engine has final say.
 */

import {
  type ClaimValidationResult,
  type PolicyConfig,
  type PolicyValidationContext,
  type RuleDefinition,
  type RuleCheckResult,
  type ClaimCategory,
  type ReasonCode,
  type EvidenceTier,
  SUPERLATIVES,
  ABSOLUTE_TERMS,
  COMPARATIVE_PATTERNS,
  WEASEL_WORDS,
  REGULATED_KEYWORDS,
} from './types'

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if text contains any of the given terms (case-insensitive)
 */
function containsAnyTerm(text: string, terms: readonly string[]): string[] {
  const lowerText = text.toLowerCase()
  return terms.filter(term => {
    const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const hasWordOnlyChars = /^[a-z0-9\s-]+$/i.test(term)
    const regex = hasWordOnlyChars
      ? new RegExp(`\\b${escapedTerm}\\b`, 'i')
      : new RegExp(escapedTerm, 'i')
    return regex.test(lowerText)
  })
}

/**
 * Check if text matches any of the given regex patterns
 */
function matchesAnyPattern(text: string, patterns: readonly RegExp[]): { matched: boolean; matches: string[] } {
  const matches: string[] = []
  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match) {
      matches.push(match[0])
    }
  }
  return { matched: matches.length > 0, matches }
}

/**
 * Detect which regulated categories a claim touches
 */
function detectRegulatedCategories(text: string): Array<keyof typeof REGULATED_KEYWORDS> {
  const categories: Array<keyof typeof REGULATED_KEYWORDS> = []
  const lowerText = text.toLowerCase()
  
  for (const [category, keywords] of Object.entries(REGULATED_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lowerText.includes(keyword.toLowerCase())) {
        categories.push(category as keyof typeof REGULATED_KEYWORDS)
        break
      }
    }
  }
  
  return categories
}

/**
 * Detect claim category from content
 */
function detectClaimCategory(text: string): ClaimCategory {
  if (/\b(hipaa|gdpr)\b/i.test(text)) return 'compliance'

  const categories = detectRegulatedCategories(text)
  
  if (categories.includes('health') || categories.includes('legal')) return 'compliance'
  if (categories.includes('security')) return 'security'
  if (categories.includes('finance')) return 'pricing'
  
  // Check for performance indicators
  const performanceTerms = ['faster', 'speed', 'performance', 'efficiency', 'productivity', 'time', 'quick']
  if (containsAnyTerm(text, performanceTerms).length > 0) {
    return 'performance'
  }
  
  // Check for pricing indicators
  const pricingTerms = ['price', 'cost', 'save', 'discount', 'free', 'cheap', 'affordable', 'value']
  if (containsAnyTerm(text, pricingTerms).length > 0) {
    return 'pricing'
  }
  
  return 'generic'
}

// ============================================================================
// Rule Definitions
// ============================================================================

const rules: RuleDefinition[] = [
  // Rule 1: Forbidden Terms
  {
    id: 'forbidden_terms',
    name: 'Forbidden Terms Check',
    description: 'Blocks claims containing explicitly forbidden terms',
    check: (text: string, context: PolicyValidationContext): RuleCheckResult => {
      const triggeredTerms: string[] = []
      
      for (const term of context.policy.forbiddenTerms) {
        if (term.regex) {
          try {
            const regex = new RegExp(term.term, 'i')
            if (regex.test(text)) {
              triggeredTerms.push(term.term)
            }
          } catch {
            // Invalid regex, skip
          }
        } else {
          if (text.toLowerCase().includes(term.term.toLowerCase())) {
            triggeredTerms.push(term.term)
          }
        }
      }
      
      if (triggeredTerms.length > 0) {
        return {
          passed: false,
          reasonCode: 'FORBIDDEN_TERM',
          message: `Contains forbidden term(s): ${triggeredTerms.join(', ')}`,
          triggeredTerms,
          requiredAction: 'block',
        }
      }
      
      return { passed: true }
    },
  },
  
  // Rule 2: Superlatives and Absolutes
  {
    id: 'superlatives',
    name: 'Superlative Claims Check',
    description: 'Flags superlatives that require proof',
    check: (text: string, context: PolicyValidationContext): RuleCheckResult => {
      const blockList = context.policy.superlativeRules.block_without_proof
      const triggeredSuperlatives = containsAnyTerm(text, [...SUPERLATIVES, ...blockList])
      const triggeredAbsolutes = containsAnyTerm(text, [...ABSOLUTE_TERMS])
      
      const allTriggered = [...triggeredSuperlatives, ...triggeredAbsolutes]
      
      if (allTriggered.length > 0) {
        // If has sufficient evidence, allow with warning
        if (context.hasEvidence && context.evidenceTier === context.policy.superlativeRules.require_evidence_tier) {
          return { passed: true }
        }
        
        return {
          passed: false,
          reasonCode:
            triggeredSuperlatives.length > 0
              ? 'SUPERLATIVE_NO_PROOF'
              : 'ABSOLUTE_CLAIM',
          message: `Superlative/absolute claim requires Tier ${context.policy.superlativeRules.require_evidence_tier} evidence: ${allTriggered.join(', ')}`,
          triggeredTerms: allTriggered,
          requiredAction: 'needs_proof',
          requiredEvidenceTier: context.policy.superlativeRules.require_evidence_tier,
        }
      }
      
      return { passed: true }
    },
  },
  
  // Rule 3: Comparative and Quantified Claims
  {
    id: 'comparatives',
    name: 'Comparative Claims Check',
    description: 'Flags quantified comparisons that need baseline proof',
    check: (text: string, context: PolicyValidationContext): RuleCheckResult => {
      const { matched, matches } = matchesAnyPattern(text, COMPARATIVE_PATTERNS)
      
      if (matched) {
        if (context.hasEvidence && context.linkedEvidenceCount > 0) {
          return { passed: true }
        }
        
        return {
          passed: false,
          reasonCode: 'QUANT_DELTA_NO_SOURCE',
          message: `Quantified claim needs source: ${matches.join(', ')}`,
          triggeredTerms: matches,
          requiredAction: 'needs_proof',
          requiredEvidenceTier: 'B',
        }
      }
      
      // Check for comparative without baseline
      const comparativeWords = ['faster', 'cheaper', 'higher', 'lower', 'superior', 'better']
      const foundComparatives = containsAnyTerm(text, comparativeWords)
      const hasExplicitComparison = /\bthan\b/i.test(text)
      
      if (
        foundComparatives.length > 0 &&
        !context.hasEvidence &&
        (hasExplicitComparison || foundComparatives.some((term) => term !== 'better'))
      ) {
        return {
          passed: false,
          reasonCode: 'COMPARATIVE_NO_BASELINE',
          message: `Comparative claim without baseline: ${foundComparatives.join(', ')}`,
          triggeredTerms: foundComparatives,
          requiredAction: 'needs_proof',
          requiredEvidenceTier: 'B',
        }
      }
      
      return { passed: true }
    },
  },
  
  // Rule 4: Regulated Categories
  {
    id: 'regulated',
    name: 'Regulated Category Check',
    description: 'Enforces higher evidence requirements for regulated topics',
    check: (text: string, context: PolicyValidationContext): RuleCheckResult => {
      const detectedCategories = detectRegulatedCategories(text)
      const enabledCategories = Object.entries(context.policy.regulatedCategories)
        .filter(([_, enabled]) => enabled)
        .map(([cat]) => cat)
      
      const triggeredCategories = detectedCategories.filter(cat => 
        enabledCategories.includes(cat)
      )
      
      if (triggeredCategories.length > 0) {
        // Require Tier A evidence for regulated categories
        if (!context.hasEvidence || context.evidenceTier !== 'A') {
          return {
            passed: false,
            reasonCode: 'REGULATED_CATEGORY',
            message: `Claim touches regulated category (${triggeredCategories.join(', ')}) - requires Tier A evidence`,
            triggeredTerms: triggeredCategories,
            requiredAction: 'needs_proof',
            requiredEvidenceTier: 'A',
          }
        }
      }
      
      return { passed: true }
    },
  },
  
  // Rule 5: Weasel Words (Strict Mode Only)
  {
    id: 'weasel_words',
    name: 'Weasel Words Check',
    description: 'Flags ambiguous language in strict mode',
    check: (text: string, context: PolicyValidationContext): RuleCheckResult => {
      if (context.policy.mode !== 'strict') {
        return { passed: true }
      }
      
      const triggeredWeasels = containsAnyTerm(text, [...WEASEL_WORDS])
      
      if (triggeredWeasels.length > 0) {
        return {
          passed: false,
          reasonCode: 'WEASEL_WORDS_STRICT',
          message: `Ambiguous language (strict mode): ${triggeredWeasels.join(', ')}`,
          triggeredTerms: triggeredWeasels,
          requiredAction: 'needs_proof',
          requiredEvidenceTier: 'C',
        }
      }
      
      return { passed: true }
    },
  },
]

// ============================================================================
// Main Validation Function
// ============================================================================

/**
 * Validate a claim against all policy rules
 */
export function validateClaim(
  text: string,
  context: PolicyValidationContext
): ClaimValidationResult {
  const reasonCodes: ReasonCode[] = []
  const triggeredTerms: string[] = []
  let highestRequiredTier: EvidenceTier | null = null
  let worstAction: 'block' | 'needs_proof' | 'warn' | null = null
  
  // Run all rules
  for (const rule of rules) {
    const result = rule.check(text, context)
    
    if (!result.passed) {
      if (result.reasonCode) {
        reasonCodes.push(result.reasonCode)
      }
      if (result.triggeredTerms) {
        triggeredTerms.push(...result.triggeredTerms)
      }
      if (result.requiredEvidenceTier) {
        // A > B > C
        if (!highestRequiredTier || 
            (result.requiredEvidenceTier === 'A') ||
            (result.requiredEvidenceTier === 'B' && highestRequiredTier === 'C')) {
          highestRequiredTier = result.requiredEvidenceTier
        }
      }
      if (result.requiredAction) {
        if (result.requiredAction === 'block') {
          worstAction = 'block'
        } else if (result.requiredAction === 'needs_proof' && worstAction !== 'block') {
          worstAction = 'needs_proof'
        } else if (result.requiredAction === 'warn' && !worstAction) {
          worstAction = 'warn'
        }
      }
    }
  }
  
  // Calculate risk score
  const riskScore = calculateRiskScore(reasonCodes, triggeredTerms, context)
  
  // Determine final status
  let status: 'allowed' | 'needs_proof' | 'blocked'
  if (worstAction === 'block') {
    status = 'blocked'
  } else if (worstAction === 'needs_proof' || reasonCodes.length > 0) {
    status = 'needs_proof'
  } else {
    status = 'allowed'
  }
  
  // Detect category
  const detectedCategory = detectClaimCategory(text)
  
  return {
    status,
    reasonCodes,
    requiredEvidenceTier: highestRequiredTier,
    riskScore,
    triggeredTerms: [...new Set(triggeredTerms)],
    detectedCategory,
  }
}

/**
 * Calculate risk score based on validation findings
 */
function calculateRiskScore(
  reasonCodes: ReasonCode[],
  triggeredTerms: string[],
  context: PolicyValidationContext
): number {
  let score = 0
  
  // Base score from reason codes
  const codeWeights: Record<ReasonCode, number> = {
    FORBIDDEN_TERM: 40,
    SUPERLATIVE_NO_PROOF: 25,
    ABSOLUTE_CLAIM: 30,
    REGULATED_CATEGORY: 35,
    QUANT_DELTA_NO_SOURCE: 20,
    COMPARATIVE_NO_BASELINE: 15,
    WEASEL_WORDS_STRICT: 10,
    MISSING_EVIDENCE: 20,
  }
  
  for (const code of reasonCodes) {
    score += codeWeights[code] || 10
  }
  
  // Add for multiple triggers
  score += Math.min(triggeredTerms.length * 5, 20)
  
  // Reduce if has evidence
  if (context.hasEvidence) {
    score = Math.max(0, score - 15)
  }
  
  // Strict mode increases base risk
  if (context.policy.mode === 'strict') {
    score += 10
  }
  
  return Math.min(100, score)
}

// ============================================================================
// Batch Validation
// ============================================================================

/**
 * Validate multiple claims at once
 */
export function validateClaims(
  claims: Array<{ id: string; text: string }>,
  context: PolicyValidationContext
): Map<string, ClaimValidationResult> {
  const results = new Map<string, ClaimValidationResult>()
  
  for (const claim of claims) {
    results.set(claim.id, validateClaim(claim.text, context))
  }
  
  return results
}

// ============================================================================
// Helper Exports
// ============================================================================

export { detectClaimCategory, detectRegulatedCategories, containsAnyTerm }

/**
 * Create a default policy context for quick validation
 */
export function createDefaultPolicyContext(
  overrides?: Partial<PolicyConfig>
): PolicyValidationContext {
  const defaultPolicy: PolicyConfig = {
    mode: 'standard',
    forbiddenTerms: [
      { term: 'guaranteed', regex: false },
      { term: 'risk-free', regex: false },
    ],
    regulatedCategories: {
      security: true,
      health: true,
      finance: true,
      legal: true,
    },
    superlativeRules: {
      block_without_proof: ['best', '#1', 'only'],
      require_evidence_tier: 'A',
    },
    evidenceRequirements: {
      performance: 'B',
      security: 'A',
      pricing: 'C',
      compliance: 'A',
      generic: 'C',
    },
  }
  
  return {
    policy: { ...defaultPolicy, ...overrides },
    hasEvidence: false,
    linkedEvidenceCount: 0,
  }
}

/**
 * Parse raw policy data from database into proper PolicyConfig type
 * This handles missing properties by providing sensible defaults
 */
export function parsePolicyFromDatabase(rawPolicy: {
  mode?: string
  forbidden_terms?: unknown
  regulated_categories?: unknown
  superlative_rules?: unknown
  evidence_requirements?: unknown
}): PolicyConfig {
  const defaultRegulated = {
    security: false,
    health: false,
    finance: false,
    legal: false,
  }
  
  const defaultEvidenceReqs = {
    performance: 'C' as EvidenceTier,
    security: 'A' as EvidenceTier,
    pricing: 'C' as EvidenceTier,
    compliance: 'A' as EvidenceTier,
    generic: 'C' as EvidenceTier,
  }
  
  const defaultSuperlativeRules = {
    block_without_proof: ['best', '#1', 'only'],
    require_evidence_tier: 'A' as EvidenceTier,
  }
  
  const parsedRegulated = rawPolicy.regulated_categories as Record<string, boolean> || {}
  const parsedEvidence = rawPolicy.evidence_requirements as Record<string, string> || {}
  const parsedSuperlative = rawPolicy.superlative_rules as { block_without_proof?: string[], require_evidence_tier?: string } || {}
  const parsedForbidden = (rawPolicy.forbidden_terms as Array<{ term: string; regex?: boolean }>) || []
  
  return {
    mode: (rawPolicy.mode as 'standard' | 'strict') || 'standard',
    forbiddenTerms: parsedForbidden.map(t => ({
      term: t.term,
      regex: t.regex ?? false,
    })),
    regulatedCategories: {
      security: parsedRegulated.security ?? defaultRegulated.security,
      health: parsedRegulated.health ?? defaultRegulated.health,
      finance: parsedRegulated.finance ?? defaultRegulated.finance,
      legal: parsedRegulated.legal ?? defaultRegulated.legal,
    },
    superlativeRules: {
      block_without_proof: parsedSuperlative.block_without_proof ?? defaultSuperlativeRules.block_without_proof,
      require_evidence_tier: (parsedSuperlative.require_evidence_tier as EvidenceTier) ?? defaultSuperlativeRules.require_evidence_tier,
    },
    evidenceRequirements: {
      performance: (parsedEvidence.performance as EvidenceTier) ?? defaultEvidenceReqs.performance,
      security: (parsedEvidence.security as EvidenceTier) ?? defaultEvidenceReqs.security,
      pricing: (parsedEvidence.pricing as EvidenceTier) ?? defaultEvidenceReqs.pricing,
      compliance: (parsedEvidence.compliance as EvidenceTier) ?? defaultEvidenceReqs.compliance,
      generic: (parsedEvidence.generic as EvidenceTier) ?? defaultEvidenceReqs.generic,
    },
  }
}
