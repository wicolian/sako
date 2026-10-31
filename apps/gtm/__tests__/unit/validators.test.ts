/**
 * Message Validators Unit Tests
 * 
 * Tests the validation functions that wrap the rules engine.
 */

import { describe, it, expect } from 'vitest'
import {
  validateMessage,
  validateMessageEnhanced,
  validateAllMessages,
  validateAllMessagesEnhanced,
  isMessageBlocked,
  getMessageRiskFactors,
} from '@/lib/ai/validators'

describe('Message Validators', () => {
  // =========================================================================
  // validateMessage (Legacy API)
  // =========================================================================

  describe('validateMessage', () => {
    it('approves safe marketing copy', () => {
      const result = validateMessage('Our product helps teams collaborate better')
      
      expect(result.status).toBe('approved')
      expect(result.riskTags).toHaveLength(0)
    })

    it('blocks messages with forbidden phrases', () => {
      const result = validateMessage('Results are guaranteed!', ['guaranteed'])
      
      expect(result.status).toBe('blocked')
      expect(result.riskTags).toContain('Forbidden phrase')
    })

    it('flags messages with superlatives', () => {
      const result = validateMessage('The best solution on the market')
      
      expect(result.status).toBe('needs_evidence')
      expect(result.riskTags).toContain('Superlative')
    })

    it('flags messages with quantified claims', () => {
      const result = validateMessage('Increase productivity by 50%')
      
      expect(result.status).toBe('needs_evidence')
      expect(result.riskTags).toContain('Unverified metric')
    })

    it('returns soft strength for approved messages', () => {
      const result = validateMessage('Simple and effective solution')
      
      expect(result.strength).toBe('soft')
    })

    it('returns hard strength for flagged messages', () => {
      const result = validateMessage('The best guaranteed solution', ['guaranteed'])
      
      expect(result.strength).toBe('hard')
    })
  })

  // =========================================================================
  // validateMessageEnhanced
  // =========================================================================

  describe('validateMessageEnhanced', () => {
    it('returns detailed validation result', () => {
      const result = validateMessageEnhanced('The best solution for your needs')
      
      expect(result.status).toBe('needs_evidence')
      expect(result.reasonCodes).toContain('SUPERLATIVE_NO_PROOF')
      expect(result.riskScore).toBeGreaterThan(0)
      expect(result.requiredEvidenceTier).toBe('A')
    })

    it('detects claim category', () => {
      const securityResult = validateMessageEnhanced('SOC 2 certified platform')
      expect(securityResult.category).toBe('security')
      
      const pricingResult = validateMessageEnhanced('Save 50% on your subscription')
      expect(pricingResult.category).toBe('pricing')
      
      const performanceResult = validateMessageEnhanced('10x faster processing')
      expect(performanceResult.category).toBe('performance')
    })

    it('respects policy overrides', () => {
      const result = validateMessageEnhanced('Simple marketing copy', {
        mode: 'strict',
      })
      
      // In strict mode, weasel words are flagged
      const resultWithWeasel = validateMessageEnhanced('Up to 50% improvement', {
        mode: 'strict',
      })
      
      expect(resultWithWeasel.reasonCodes).toContain('WEASEL_WORDS_STRICT')
    })

    it('considers evidence status', () => {
      const withoutEvidence = validateMessageEnhanced('The best solution', {}, false)
      const withEvidence = validateMessageEnhanced('The best solution', {}, true, 'A', 1)
      
      expect(withoutEvidence.riskScore).toBeGreaterThan(withEvidence.riskScore)
    })

    it('returns multiple reason codes when applicable', () => {
      const result = validateMessageEnhanced('The best solution, 50% faster')
      
      expect(result.reasonCodes.length).toBeGreaterThanOrEqual(2)
    })
  })

  // =========================================================================
  // validateAllMessages (Batch)
  // =========================================================================

  describe('validateAllMessages', () => {
    it('validates multiple messages', () => {
      const messages = [
        'Safe marketing copy',
        'The best product',
        'Guaranteed results',
      ]
      
      const results = validateAllMessages(messages, ['guaranteed'])
      
      expect(results.size).toBe(3)
      expect(results.get('Safe marketing copy')?.status).toBe('approved')
      expect(results.get('The best product')?.status).toBe('needs_evidence')
      expect(results.get('Guaranteed results')?.status).toBe('blocked')
    })

    it('handles empty array', () => {
      const results = validateAllMessages([])
      
      expect(results.size).toBe(0)
    })

    it('applies forbidden phrases to all messages', () => {
      const messages = ['Guaranteed A', 'Guaranteed B', 'Safe C']
      const results = validateAllMessages(messages, ['guaranteed'])
      
      expect(results.get('Guaranteed A')?.status).toBe('blocked')
      expect(results.get('Guaranteed B')?.status).toBe('blocked')
      expect(results.get('Safe C')?.status).toBe('approved')
    })
  })

  describe('validateAllMessagesEnhanced', () => {
    it('returns enhanced results for all messages', () => {
      const messages = ['The best solution', '50% faster processing']
      const results = validateAllMessagesEnhanced(messages)
      
      expect(results.size).toBe(2)
      
      const bestResult = results.get('The best solution')
      expect(bestResult?.reasonCodes).toContain('SUPERLATIVE_NO_PROOF')
      expect(bestResult?.riskScore).toBeGreaterThan(0)
      
      const fasterResult = results.get('50% faster processing')
      expect(fasterResult?.reasonCodes).toContain('QUANT_DELTA_NO_SOURCE')
    })
  })

  // =========================================================================
  // isMessageBlocked
  // =========================================================================

  describe('isMessageBlocked', () => {
    it('returns true for blocked messages', () => {
      expect(isMessageBlocked('Guaranteed results', ['guaranteed'])).toBe(true)
    })

    it('returns false for approved messages', () => {
      expect(isMessageBlocked('Great product', [])).toBe(false)
    })

    it('returns false for messages needing evidence', () => {
      expect(isMessageBlocked('The best solution', [])).toBe(false)
    })
  })

  // =========================================================================
  // getMessageRiskFactors
  // =========================================================================

  describe('getMessageRiskFactors', () => {
    it('returns comprehensive risk information', () => {
      const factors = getMessageRiskFactors('The best guaranteed solution', {
        forbiddenTerms: [{ term: 'guaranteed', regex: false }],
      })
      
      expect(factors.blocked).toBe(true)
      expect(factors.factors).toContain('Forbidden phrase')
      expect(factors.factors).toContain('Superlative')
      expect(factors.score).toBeGreaterThan(50)
    })

    it('identifies evidence needs', () => {
      const factors = getMessageRiskFactors('50% faster than competitors')
      
      expect(factors.needsEvidence).toBe(true)
      expect(factors.blocked).toBe(false)
    })

    it('returns low score for safe messages', () => {
      const factors = getMessageRiskFactors('Simple and effective')
      
      expect(factors.score).toBeLessThan(20)
      expect(factors.factors).toHaveLength(0)
    })
  })

  // =========================================================================
  // Edge Cases
  // =========================================================================

  describe('Edge Cases', () => {
    it('handles empty string', () => {
      const result = validateMessage('')
      expect(result.status).toBe('approved')
    })

    it('handles whitespace only', () => {
      const result = validateMessage('   ')
      expect(result.status).toBe('approved')
    })

    it('handles multiple forbidden phrases', () => {
      const result = validateMessage('Guaranteed risk-free offer', ['guaranteed', 'risk-free'])
      
      expect(result.status).toBe('blocked')
      expect(result.riskTags.filter(t => t === 'Forbidden phrase')).toHaveLength(2)
    })

    it('handles case variations', () => {
      expect(validateMessage('GUARANTEED', ['guaranteed']).status).toBe('blocked')
      expect(validateMessage('GuArAnTeEd', ['guaranteed']).status).toBe('blocked')
    })

    it('handles numbers in messages', () => {
      const result = validateMessage('100% satisfaction guaranteed', ['guaranteed'])
      
      expect(result.status).toBe('blocked')
      expect(result.riskTags).toContain('Absolute claim')
    })
  })

  // =========================================================================
  // Risk Tag Mapping
  // =========================================================================

  describe('Risk Tag Mapping', () => {
    it('maps SUPERLATIVE_NO_PROOF to Superlative', () => {
      const result = validateMessageEnhanced('The best solution')
      expect(result.riskTags).toContain('Superlative')
    })

    it('maps QUANT_DELTA_NO_SOURCE to Unverified metric', () => {
      const result = validateMessageEnhanced('50% faster processing')
      expect(result.riskTags).toContain('Unverified metric')
    })

    it('maps COMPARATIVE_NO_BASELINE to Comparison', () => {
      const result = validateMessageEnhanced('Our solution is faster')
      expect(result.riskTags).toContain('Comparison')
    })

    it('maps REGULATED_CATEGORY to Regulated category', () => {
      const result = validateMessageEnhanced('SOC 2 certified platform', {
        regulatedCategories: { security: true, health: false, finance: false, legal: false },
      })
      expect(result.riskTags).toContain('Regulated category')
    })
  })
})
