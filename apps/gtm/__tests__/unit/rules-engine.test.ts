/**
 * ClaimsOS Rules Engine Unit Tests
 * 
 * Tests the deterministic rules engine for claim validation.
 */

import { describe, it, expect } from 'vitest'
import {
  validateClaim,
  validateClaims,
  createDefaultPolicyContext,
  detectClaimCategory,
  detectRegulatedCategories,
  containsAnyTerm,
  parsePolicyFromDatabase,
} from '@/lib/claims/rules-engine'
import type { PolicyValidationContext, PolicyConfig } from '@/lib/claims/types'

describe('ClaimsOS Rules Engine', () => {
  // =========================================================================
  // Helper Functions
  // =========================================================================
  
  describe('containsAnyTerm', () => {
    it('detects terms case-insensitively', () => {
      expect(containsAnyTerm('We are the BEST company', ['best'])).toContain('best')
      expect(containsAnyTerm('WE ARE THE BEST COMPANY', ['best'])).toContain('best')
      expect(containsAnyTerm('We are the best company', ['BEST'])).toContain('BEST')
    })

    it('respects word boundaries', () => {
      expect(containsAnyTerm('This is the fastest solution', ['fast'])).toHaveLength(0)
      expect(containsAnyTerm('This is fast', ['fast'])).toContain('fast')
    })

    it('handles special characters', () => {
      expect(containsAnyTerm('We are #1 in the market', ['#1'])).toContain('#1')
    })

    it('returns empty array when no matches', () => {
      expect(containsAnyTerm('Regular marketing copy', ['best', 'worst'])).toHaveLength(0)
    })

    it('finds multiple terms', () => {
      const result = containsAnyTerm('We are the best and fastest', ['best', 'fastest'])
      expect(result).toContain('best')
      expect(result).toContain('fastest')
    })
  })

  describe('detectClaimCategory', () => {
    it('detects security claims', () => {
      expect(detectClaimCategory('SOC 2 certified platform')).toBe('security')
      expect(detectClaimCategory('Encrypted data storage')).toBe('security')
      expect(detectClaimCategory('Zero-trust architecture')).toBe('security')
    })

    it('detects pricing claims', () => {
      expect(detectClaimCategory('Save 50% on your bill')).toBe('pricing')
      expect(detectClaimCategory('Most affordable option')).toBe('pricing')
      expect(detectClaimCategory('Free trial available')).toBe('pricing')
    })

    it('detects performance claims', () => {
      expect(detectClaimCategory('10x faster than competitors')).toBe('performance')
      expect(detectClaimCategory('Improve productivity by 30%')).toBe('performance')
      expect(detectClaimCategory('Quick and efficient')).toBe('performance')
    })

    it('detects compliance claims', () => {
      expect(detectClaimCategory('HIPAA compliant platform')).toBe('compliance')
      expect(detectClaimCategory('GDPR certified solution')).toBe('compliance')
    })

    it('returns generic for unclassified claims', () => {
      expect(detectClaimCategory('Great customer service')).toBe('generic')
      expect(detectClaimCategory('Easy to use')).toBe('generic')
    })
  })

  describe('detectRegulatedCategories', () => {
    it('detects security keywords', () => {
      expect(detectRegulatedCategories('We are SOC 2 certified')).toContain('security')
      expect(detectRegulatedCategories('Encrypted at rest')).toContain('security')
    })

    it('detects health keywords', () => {
      expect(detectRegulatedCategories('FDA approved treatment')).toContain('health')
      expect(detectRegulatedCategories('Clinical trial results')).toContain('health')
    })

    it('detects finance keywords', () => {
      expect(detectRegulatedCategories('ROI of 200%')).toContain('finance')
      expect(detectRegulatedCategories('SEC compliant reporting')).toContain('finance')
    })

    it('detects legal keywords', () => {
      expect(detectRegulatedCategories('Legally binding contract')).toContain('legal')
    })

    it('detects multiple categories', () => {
      const categories = detectRegulatedCategories('HIPAA compliant with SOC 2 certification')
      expect(categories).toContain('security')
      expect(categories).toContain('health')
    })
  })

  // =========================================================================
  // Rule Validation
  // =========================================================================

  describe('validateClaim', () => {
    describe('Forbidden Terms Rule', () => {
      it('blocks claims with forbidden terms', () => {
        const context = createDefaultPolicyContext({
          forbiddenTerms: [{ term: 'guaranteed', regex: false }],
        })
        
        const result = validateClaim('Results guaranteed', context)
        
        expect(result.status).toBe('blocked')
        expect(result.reasonCodes).toContain('FORBIDDEN_TERM')
        expect(result.triggeredTerms).toContain('guaranteed')
      })

      it('supports regex patterns', () => {
        const context = createDefaultPolicyContext({
          forbiddenTerms: [{ term: '\\d+%\\s+return', regex: true }],
        })
        
        const result = validateClaim('Get 50% return on investment', context)
        
        expect(result.status).toBe('blocked')
        expect(result.reasonCodes).toContain('FORBIDDEN_TERM')
      })

      it('allows claims without forbidden terms', () => {
        const context = createDefaultPolicyContext({
          forbiddenTerms: [{ term: 'guaranteed', regex: false }],
        })
        
        const result = validateClaim('Great results for your business', context)
        
        expect(result.status).not.toBe('blocked')
        expect(result.reasonCodes).not.toContain('FORBIDDEN_TERM')
      })
    })

    describe('Superlatives Rule', () => {
      it('flags superlatives without evidence', () => {
        const context = createDefaultPolicyContext()
        context.hasEvidence = false
        
        const result = validateClaim('The best solution on the market', context)
        
        expect(result.reasonCodes).toContain('SUPERLATIVE_NO_PROOF')
        expect(result.triggeredTerms).toContain('best')
        expect(result.requiredEvidenceTier).toBe('A')
      })

      it('flags absolute terms', () => {
        const context = createDefaultPolicyContext()
        
        const result = validateClaim('100% satisfaction rate', context)
        
        expect(result.reasonCodes).toContain('ABSOLUTE_CLAIM')
      })

      it('allows superlatives with proper evidence', () => {
        const context = createDefaultPolicyContext()
        context.hasEvidence = true
        context.evidenceTier = 'A'
        
        const result = validateClaim('The best solution on the market', context)
        
        expect(result.reasonCodes).not.toContain('SUPERLATIVE_NO_PROOF')
      })
    })

    describe('Comparative Claims Rule', () => {
      it('flags quantified claims without source', () => {
        const context = createDefaultPolicyContext()
        
        const result = validateClaim('50% faster than the competition', context)
        
        expect(result.reasonCodes).toContain('QUANT_DELTA_NO_SOURCE')
        expect(result.requiredEvidenceTier).toBe('B')
      })

      it('flags comparatives without baseline', () => {
        const context = createDefaultPolicyContext()
        
        const result = validateClaim('Our solution is faster', context)
        
        expect(result.reasonCodes).toContain('COMPARATIVE_NO_BASELINE')
      })

      it('allows comparatives with evidence', () => {
        const context = createDefaultPolicyContext()
        context.hasEvidence = true
        context.linkedEvidenceCount = 1
        
        const result = validateClaim('50% faster than the competition', context)
        
        expect(result.reasonCodes).not.toContain('QUANT_DELTA_NO_SOURCE')
      })
    })

    describe('Regulated Categories Rule', () => {
      it('requires Tier A evidence for regulated claims', () => {
        const context = createDefaultPolicyContext({
          regulatedCategories: { security: true, health: false, finance: false, legal: false },
        })
        
        const result = validateClaim('SOC 2 certified platform', context)
        
        expect(result.reasonCodes).toContain('REGULATED_CATEGORY')
        expect(result.requiredEvidenceTier).toBe('A')
      })

      it('allows regulated claims with Tier A evidence', () => {
        const context = createDefaultPolicyContext({
          regulatedCategories: { security: true, health: false, finance: false, legal: false },
        })
        context.hasEvidence = true
        context.evidenceTier = 'A'
        
        const result = validateClaim('SOC 2 certified platform', context)
        
        expect(result.reasonCodes).not.toContain('REGULATED_CATEGORY')
      })

      it('ignores disabled regulated categories', () => {
        const context = createDefaultPolicyContext({
          regulatedCategories: { security: false, health: false, finance: false, legal: false },
        })
        
        const result = validateClaim('SOC 2 certified platform', context)
        
        expect(result.reasonCodes).not.toContain('REGULATED_CATEGORY')
      })
    })

    describe('Weasel Words Rule (Strict Mode)', () => {
      it('flags weasel words in strict mode', () => {
        const context = createDefaultPolicyContext({ mode: 'strict' })
        
        const result = validateClaim('Up to 50% improvement', context)
        
        expect(result.reasonCodes).toContain('WEASEL_WORDS_STRICT')
      })

      it('allows weasel words in standard mode', () => {
        const context = createDefaultPolicyContext({ mode: 'standard' })
        
        const result = validateClaim('Up to 50% improvement', context)
        
        expect(result.reasonCodes).not.toContain('WEASEL_WORDS_STRICT')
      })
    })
  })

  // =========================================================================
  // Risk Score Calculation
  // =========================================================================

  describe('Risk Score Calculation', () => {
    it('calculates higher scores for more severe issues', () => {
      const context = createDefaultPolicyContext({
        forbiddenTerms: [{ term: 'guaranteed', regex: false }],
      })
      
      const blockedResult = validateClaim('Guaranteed results', context)
      const warningResult = validateClaim('The best solution', context)
      
      expect(blockedResult.riskScore).toBeGreaterThan(warningResult.riskScore)
    })

    it('reduces score when evidence is present', () => {
      const withoutEvidence = createDefaultPolicyContext()
      const withEvidence = createDefaultPolicyContext()
      withEvidence.hasEvidence = true
      
      const resultWithout = validateClaim('50% faster', withoutEvidence)
      const resultWith = validateClaim('50% faster', withEvidence)
      
      expect(resultWithout.riskScore).toBeGreaterThan(resultWith.riskScore)
    })

    it('caps risk score at 100', () => {
      const context = createDefaultPolicyContext({
        mode: 'strict',
        forbiddenTerms: [{ term: 'guaranteed', regex: false }],
        regulatedCategories: { security: true, health: true, finance: true, legal: true },
      })
      
      const result = validateClaim('Guaranteed best FDA approved SOC 2 financial solution', context)
      
      expect(result.riskScore).toBeLessThanOrEqual(100)
    })
  })

  // =========================================================================
  // Batch Validation
  // =========================================================================

  describe('validateClaims (batch)', () => {
    it('validates multiple claims', () => {
      const context = createDefaultPolicyContext()
      const claims = [
        { id: '1', text: 'Regular marketing copy' },
        { id: '2', text: 'The best solution' },
        { id: '3', text: 'Guaranteed results' },
      ]
      
      context.policy.forbiddenTerms = [{ term: 'guaranteed', regex: false }]
      
      const results = validateClaims(claims, context)
      
      expect(results.size).toBe(3)
      expect(results.get('1')?.status).toBe('allowed')
      expect(results.get('2')?.status).toBe('needs_proof')
      expect(results.get('3')?.status).toBe('blocked')
    })
  })

  // =========================================================================
  // Policy Parsing
  // =========================================================================

  describe('parsePolicyFromDatabase', () => {
    it('parses raw database policy correctly', () => {
      const rawPolicy = {
        mode: 'strict',
        forbidden_terms: [{ term: 'guaranteed', regex: false }],
        regulated_categories: { security: true, health: false },
        superlative_rules: { block_without_proof: ['best'], require_evidence_tier: 'A' },
        evidence_requirements: { performance: 'B', security: 'A' },
      }
      
      const parsed = parsePolicyFromDatabase(rawPolicy)
      
      expect(parsed.mode).toBe('strict')
      expect(parsed.forbiddenTerms).toHaveLength(1)
      expect(parsed.regulatedCategories.security).toBe(true)
      expect(parsed.superlativeRules.require_evidence_tier).toBe('A')
    })

    it('provides defaults for missing properties', () => {
      const rawPolicy = {}
      
      const parsed = parsePolicyFromDatabase(rawPolicy)
      
      expect(parsed.mode).toBe('standard')
      expect(parsed.forbiddenTerms).toHaveLength(0)
      expect(parsed.regulatedCategories).toBeDefined()
      expect(parsed.superlativeRules).toBeDefined()
      expect(parsed.evidenceRequirements).toBeDefined()
    })
  })

  // =========================================================================
  // Edge Cases
  // =========================================================================

  describe('Edge Cases', () => {
    it('handles empty text', () => {
      const context = createDefaultPolicyContext()
      const result = validateClaim('', context)
      
      expect(result.status).toBe('allowed')
      expect(result.riskScore).toBeLessThan(20)
    })

    it('handles very long text', () => {
      const context = createDefaultPolicyContext()
      const longText = 'Great product with excellent features. '.repeat(100)
      
      const result = validateClaim(longText, context)
      
      expect(result).toBeDefined()
      expect(result.status).toBeDefined()
    })

    it('handles special characters', () => {
      const context = createDefaultPolicyContext()
      const result = validateClaim('Product™ is the best® solution© for your needs!', context)
      
      expect(result).toBeDefined()
      expect(result.triggeredTerms).toContain('best')
    })

    it('handles unicode text', () => {
      const context = createDefaultPolicyContext()
      const result = validateClaim('最好的解决方案 - The best solution', context)
      
      expect(result).toBeDefined()
      expect(result.triggeredTerms).toContain('best')
    })
  })
})
