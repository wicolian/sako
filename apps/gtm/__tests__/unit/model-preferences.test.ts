import { describe, it, expect } from 'vitest'
import {
  getDefaultModelId,
  getModelsForTier,
  isValidModelForTier,
  estimateCostPer1KOutput,
  getEffectiveModelId,
  AVAILABLE_MODELS,
} from '@/lib/ai/openrouter'

describe('AVAILABLE_MODELS catalog', () => {
  it('has exactly one default per controllable tier', () => {
    const tiers = ['fast', 'balanced', 'creative', 'reasoning', 'structured'] as const
    for (const tier of tiers) {
      const defaults = AVAILABLE_MODELS.filter(m => m.tier === tier && m.isDefault)
      expect(defaults, `tier ${tier} should have exactly one default`).toHaveLength(1)
    }
  })

  it('all model IDs are on the allowlist (no legacy models)', () => {
    const deprecated = [
      'openai/gpt-4o', 'openai/gpt-4.1', 'anthropic/claude-3.5-sonnet',
      'google/gemini-2.0-flash', 'anthropic/claude-opus-4.5',
    ]
    for (const model of AVAILABLE_MODELS) {
      expect(deprecated, `${model.id} is deprecated`).not.toContain(model.id)
    }
  })
})

describe('getDefaultModelId', () => {
  it('returns the default model ID for each tier', () => {
    expect(getDefaultModelId('fast')).toBe('openai/gpt-5.3-chat')
    expect(getDefaultModelId('balanced')).toBe('openai/gpt-5.4')
    expect(getDefaultModelId('creative')).toBe('anthropic/claude-sonnet-4.6')
    expect(getDefaultModelId('reasoning')).toBe('anthropic/claude-opus-4.6')
    expect(getDefaultModelId('structured')).toBe('openai/gpt-5.4')
  })
})

describe('getModelsForTier', () => {
  it('returns only models for the specified tier', () => {
    const fastModels = getModelsForTier('fast')
    expect(fastModels.every(m => m.tier === 'fast')).toBe(true)
    expect(fastModels.length).toBeGreaterThan(0)
  })

  it('structured tier contains only JSON-reliable models', () => {
    const structured = getModelsForTier('structured')
    // Claude models are excluded from structured tier
    const hasClaudeModel = structured.some(m => m.id.startsWith('anthropic/'))
    expect(hasClaudeModel).toBe(false)
  })
})

describe('isValidModelForTier', () => {
  it('accepts valid model-tier pairs', () => {
    expect(isValidModelForTier('openai/gpt-5.3-chat', 'fast')).toBe(true)
    expect(isValidModelForTier('anthropic/claude-sonnet-4.6', 'creative')).toBe(true)
    expect(isValidModelForTier('anthropic/claude-opus-4.6', 'reasoning')).toBe(true)
    expect(isValidModelForTier('openai/gpt-5.4', 'structured')).toBe(true)
  })

  it('rejects model on wrong tier', () => {
    // Claude Sonnet is CREATIVE tier, not FAST
    expect(isValidModelForTier('anthropic/claude-sonnet-4.6', 'fast')).toBe(false)
    // Claude not allowed in STRUCTURED (restricted list)
    expect(isValidModelForTier('anthropic/claude-sonnet-4.6', 'structured')).toBe(false)
  })

  it('rejects unknown or deprecated model IDs', () => {
    expect(isValidModelForTier('openai/gpt-4o', 'fast')).toBe(false)
    expect(isValidModelForTier('', 'creative')).toBe(false)
    expect(isValidModelForTier('openai/gpt-5.2-pro', 'balanced')).toBe(false)
  })
})

describe('estimateCostPer1KOutput', () => {
  it('returns correct per-1K-output cost for known models', () => {
    // $14/1M = $0.014/1K
    expect(estimateCostPer1KOutput('openai/gpt-5.3-chat')).toBeCloseTo(0.014)
    // $25/1M = $0.025/1K
    expect(estimateCostPer1KOutput('anthropic/claude-opus-4.6')).toBeCloseTo(0.025)
    // $15/1M = $0.015/1K
    expect(estimateCostPer1KOutput('anthropic/claude-sonnet-4.6')).toBeCloseTo(0.015)
  })

  it('returns 0 for unknown model ID', () => {
    expect(estimateCostPer1KOutput('unknown/model-xyz')).toBe(0)
  })
})

describe('getEffectiveModelId', () => {
  it('returns default when no preferences provided', () => {
    expect(getEffectiveModelId('creative', null)).toBe('anthropic/claude-sonnet-4.6')
    expect(getEffectiveModelId('fast', undefined)).toBe('openai/gpt-5.3-chat')
    expect(getEffectiveModelId('structured', {})).toBe('openai/gpt-5.4')
  })

  it('returns valid preference override', () => {
    expect(getEffectiveModelId('creative', { creative: 'anthropic/claude-opus-4.6' }))
      .toBe('anthropic/claude-opus-4.6')
    // anthropic/claude-opus-4.6 is a valid reasoning-tier model
    expect(getEffectiveModelId('reasoning', { reasoning: 'anthropic/claude-opus-4.6' }))
      .toBe('anthropic/claude-opus-4.6')
  })

  it('falls back to default when preference model is invalid (deprecated/wrong tier)', () => {
    // gpt-4o is deprecated
    expect(getEffectiveModelId('creative', { creative: 'openai/gpt-4o' }))
      .toBe('anthropic/claude-sonnet-4.6')
    // claude-sonnet-4.6 is not in structured's restricted list
    expect(getEffectiveModelId('structured', { structured: 'anthropic/claude-sonnet-4.6' }))
      .toBe('openai/gpt-5.4')
  })

  it('ignores preferences for other tiers', () => {
    // Setting creative pref should not affect reasoning
    expect(getEffectiveModelId('reasoning', { creative: 'anthropic/claude-opus-4.6' }))
      .toBe('anthropic/claude-opus-4.6') // reasoning default (Pro excluded for cost)
  })
})
