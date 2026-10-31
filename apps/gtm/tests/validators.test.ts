import { describe, it, expect } from 'vitest'
import { validateMessage, validateAllMessages } from '../lib/ai/validators'

describe('Message Validators', () => {
  describe('validateMessage', () => {
    it('approves clean messages', () => {
      const result = validateMessage('Our product helps you save time')
      expect(result.status).toBe('approved')
      expect(result.riskTags).toHaveLength(0)
    })

    it('flags superlatives as needing evidence', () => {
      const result = validateMessage('The best solution on the market')
      expect(result.status).toBe('needs_evidence')
      expect(result.riskTags).toContain('Superlative')
      expect(result.strength).toBe('hard')
    })

    it('flags multiple superlatives', () => {
      const messages = [
        'The #1 fastest solution',
        'Most affordable option',
        'Leading technology',
      ]
      
      for (const message of messages) {
        const result = validateMessage(message)
        expect(result.status).toBe('needs_evidence')
        expect(result.riskTags).toContain('Superlative')
      }
    })

    it('flags comparisons as needing evidence', () => {
      const result = validateMessage('Better than the competition')
      expect(result.status).toBe('needs_evidence')
      expect(result.riskTags).toContain('Comparison')
    })

    it('blocks forbidden phrases', () => {
      const result = validateMessage(
        'This is guaranteed to work',
        ['guaranteed', 'risk-free']
      )
      expect(result.status).toBe('blocked')
      expect(result.riskTags).toContain('Forbidden phrase')
    })

    it('flags unverified metrics', () => {
      const result = validateMessage('Saves you 50% time')
      expect(result.status).toBe('needs_evidence')
      expect(result.riskTags).toContain('Unverified metric')
    })

    it('allows hedged metrics', () => {
      const result = validateMessage('Can save up to 50% time')
      // Still needs evidence for percentage, but not blocked
      expect(result.status).not.toBe('blocked')
    })

    it('forbidden phrase takes precedence over other flags', () => {
      const result = validateMessage(
        'The best guaranteed solution',
        ['guaranteed']
      )
      expect(result.status).toBe('blocked')
    })
  })

  describe('validateAllMessages', () => {
    it('validates multiple messages', () => {
      const messages = [
        'Clean message here',
        'The best solution',
        'Risk-free trial',
      ]
      
      const results = validateAllMessages(messages, ['risk-free'])
      
      expect(results.get('Clean message here')?.status).toBe('approved')
      expect(results.get('The best solution')?.status).toBe('needs_evidence')
      expect(results.get('Risk-free trial')?.status).toBe('blocked')
    })
  })
})
