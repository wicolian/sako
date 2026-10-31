/**
 * AI Tracing Unit Tests
 * 
 * Tests the AI tracing and cost calculation system.
 */

import { describe, it, expect, vi } from 'vitest'
import { calculateCost } from '@/lib/ai/tracing'

// Mock supabase for tests that need it
vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: vi.fn(() => ({
    from: vi.fn(() => ({
      insert: vi.fn(() => Promise.resolve({ error: null })),
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          gte: vi.fn(() => ({
            lte: vi.fn(() => Promise.resolve({ data: [] })),
          })),
        })),
      })),
    })),
  })),
}))

describe('AI Tracing', () => {
  // =========================================================================
  // Cost Calculation
  // =========================================================================

  describe('calculateCost', () => {
    it('calculates cost for GPT-5.2', () => {
      const cost = calculateCost('openai/gpt-5.2', 1000, 500)

      expect(cost.model).toBe('openai/gpt-5.2')
      expect(cost.inputTokens).toBe(1000)
      expect(cost.outputTokens).toBe(500)
      expect(cost.inputCost).toBeGreaterThan(0)
      expect(cost.outputCost).toBeGreaterThan(0)
      expect(cost.totalCost).toBe(cost.inputCost + cost.outputCost)
    })

    it('calculates cost for Claude Opus 4.6', () => {
      const cost = calculateCost('anthropic/claude-opus-4.6', 1000, 500)

      expect(cost.model).toBe('anthropic/claude-opus-4.6')
      expect(cost.totalCost).toBeGreaterThan(0)
    })

    it('calculates cost for Gemini 3.1 Pro Preview', () => {
      const cost = calculateCost('google/gemini-3.1-pro-preview', 1000, 500)

      expect(cost.model).toBe('google/gemini-3.1-pro-preview')
      expect(cost.totalCost).toBeGreaterThan(0)
    })

    it('calculates cost for embeddings (output cost is 0)', () => {
      const cost = calculateCost('openai/text-embedding-3-large', 1000, 0)

      expect(cost.outputCost).toBe(0)
      expect(cost.inputCost).toBeGreaterThan(0)
      expect(cost.totalCost).toBe(cost.inputCost)
    })

    it('handles unknown models gracefully', () => {
      const cost = calculateCost('unknown/model', 1000, 500)

      expect(cost.model).toBe('unknown/model')
      expect(cost.inputCost).toBe(0)
      expect(cost.outputCost).toBe(0)
      expect(cost.totalCost).toBe(0)
    })

    it('handles zero tokens', () => {
      const cost = calculateCost('openai/gpt-5.2', 0, 0)

      expect(cost.inputTokens).toBe(0)
      expect(cost.outputTokens).toBe(0)
      expect(cost.totalCost).toBe(0)
    })

    it('scales linearly with token count', () => {
      const cost1k = calculateCost('openai/gpt-5.2', 1000, 1000)
      const cost2k = calculateCost('openai/gpt-5.2', 2000, 2000)

      expect(cost2k.totalCost).toBeCloseTo(cost1k.totalCost * 2, 5)
    })
  })

  // =========================================================================
  // Model Pricing Tiers
  // =========================================================================

  describe('Model Pricing Tiers', () => {
    it('gemini pro is cheaper than claude opus', () => {
      const opus = calculateCost('anthropic/claude-opus-4.6', 1000000, 1000000)
      const gemini = calculateCost('google/gemini-3.1-pro-preview', 1000000, 1000000)

      expect(gemini.totalCost).toBeLessThan(opus.totalCost)
    })

    it('opus is more expensive than gpt-5.4 flagship', () => {
      const flagship = calculateCost('openai/gpt-5.4', 1000000, 1000000)
      const opus = calculateCost('anthropic/claude-opus-4.6', 1000000, 1000000)

      expect(opus.totalCost).toBeGreaterThan(flagship.totalCost)
    })

    it('opus is more expensive than sonnet', () => {
      const opus = calculateCost('anthropic/claude-opus-4.6', 1000000, 1000000)
      const sonnet = calculateCost('anthropic/claude-sonnet-4.6', 1000000, 1000000)

      expect(opus.totalCost).toBeGreaterThan(sonnet.totalCost)
    })

    it('gemini pro is cheaper than claude sonnet', () => {
      const gemini = calculateCost('google/gemini-3.1-pro-preview', 1000000, 1000000)
      const sonnet = calculateCost('anthropic/claude-sonnet-4.6', 1000000, 1000000)

      expect(gemini.totalCost).toBeLessThan(sonnet.totalCost)
    })
  })

  // =========================================================================
  // Cost Estimation Helpers
  // =========================================================================

  describe('Cost Estimation', () => {
    // Average tokens per operation type
    const AVG_TOKENS = {
      campaign: { input: 2000, output: 4000 },
      landing_page: { input: 1500, output: 3000 },
      claim_validation: { input: 500, output: 200 },
      email_sequence: { input: 1000, output: 2000 },
    }

    const estimateOperationCost = (operation: keyof typeof AVG_TOKENS, model: string): number => {
      const tokens = AVG_TOKENS[operation]
      const cost = calculateCost(model, tokens.input, tokens.output)
      return Math.round(cost.totalCost * 1000) // In mills for better comparison granularity
    }

    it('estimates campaign generation cost', () => {
      const cost = estimateOperationCost('campaign', 'openai/gpt-5.3-chat')
      expect(cost).toBeGreaterThan(0)
      expect(cost).toBeLessThan(100) // Less than $1
    })

    it('claim validation is cheaper than campaign', () => {
      const campaignCost = estimateOperationCost('campaign', 'openai/gpt-5.3-chat')
      const claimCost = estimateOperationCost('claim_validation', 'openai/gpt-5.3-chat')

      expect(claimCost).toBeLessThan(campaignCost)
    })
  })

  // =========================================================================
  // Trace Data Formatting
  // =========================================================================

  describe('Trace Data Formatting', () => {
    interface TraceData {
      model: string
      promptTokens: number
      completionTokens: number
      latencyMs: number
      success: boolean
      error?: string
    }

    const formatTraceForLog = (trace: TraceData): string => {
      const cost = calculateCost(trace.model, trace.promptTokens, trace.completionTokens)
      return `[AI] ${trace.model} | ${trace.latencyMs}ms | $${cost.totalCost.toFixed(4)}${trace.success ? '' : ' | ERROR: ' + trace.error}`
    }

    it('formats successful trace', () => {
      const log = formatTraceForLog({
        model: 'openai/gpt-5.2',
        promptTokens: 1000,
        completionTokens: 500,
        latencyMs: 1500,
        success: true,
      })

      expect(log).toContain('openai/gpt-5.2')
      expect(log).toContain('1500ms')
      expect(log).toContain('$')
      expect(log).not.toContain('ERROR')
    })

    it('formats failed trace with error', () => {
      const log = formatTraceForLog({
        model: 'openai/gpt-5.2',
        promptTokens: 500,
        completionTokens: 0,
        latencyMs: 500,
        success: false,
        error: 'Rate limit exceeded',
      })

      expect(log).toContain('ERROR')
      expect(log).toContain('Rate limit exceeded')
    })
  })

  // =========================================================================
  // Model Normalization
  // =========================================================================

  describe('Model Name Handling', () => {
    it('handles OpenRouter format (provider/model)', () => {
      const cost = calculateCost('openai/gpt-5.2', 1000, 500)
      expect(cost.totalCost).toBeGreaterThan(0)
    })

    it('unprefixed model IDs return zero cost (OpenRouter format required)', () => {
      // Since Feb 2026 migration, only OpenRouter-prefixed IDs are in MODEL_PRICING.
      // Unprefixed IDs fall through to the "unknown model" path and return 0.
      const cost = calculateCost('gpt-5.2', 1000, 500)
      expect(cost.totalCost).toBe(0)
    })

    it('prefixed and unprefixed formats return different cost (prefix is required)', () => {
      const prefixed = calculateCost('openai/gpt-5.2', 1000, 500)
      const unprefixed = calculateCost('gpt-5.2', 1000, 500)

      // prefixed resolves to a known model; unprefixed is unknown → 0
      expect(prefixed.totalCost).toBeGreaterThan(unprefixed.totalCost)
    })
  })
})
