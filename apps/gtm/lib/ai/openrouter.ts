/**
 * OpenRouter Provider Configuration (Feb 2026)
 *
 * Single provider instance for all AI calls.
 * Uses @openrouter/ai-sdk-provider with Vercel AI SDK v6.
 *
 * Provider Routing Features:
 * - Automatic fallbacks across providers
 * - Price-based load balancing (default)
 * - Data collection denied for compliance
 * - Parameter requirement enforcement
 *
 * @see https://openrouter.ai/docs/quickstart
 * @see https://openrouter.ai/docs/features/model-routing
 * @see https://openrouter.ai/docs/guides/routing/model-fallbacks
 */

import { createOpenRouter, type OpenRouterProvider } from '@openrouter/ai-sdk-provider';

// ============================================================================
// Types
// ============================================================================

/**
 * Provider routing preferences per OpenRouter docs.
 * @see https://openrouter.ai/docs/features/model-routing
 */
export interface ProviderRoutingOptions {
  /** List of provider slugs to try in order (e.g. ["anthropic", "openai"]) */
  order?: string[];
  /** Whether to allow backup providers when primary is unavailable */
  allow_fallbacks?: boolean;
  /** Only use providers that support all parameters in your request */
  require_parameters?: boolean;
  /** Control whether to use providers that may store data */
  data_collection?: 'allow' | 'deny';
  /** Restrict routing to only ZDR (Zero Data Retention) endpoints */
  zdr?: boolean;
  /** Sort providers by price, throughput, or latency */
  sort?: 'price' | 'throughput' | 'latency' | {
    by: 'price' | 'throughput' | 'latency';
    partition: 'model' | 'none';
  };
  /** Preferred minimum throughput (tokens/sec) */
  preferred_min_throughput?: number | {
    p50?: number;
    p75?: number;
    p90?: number;
    p99?: number;
  };
  /** Preferred maximum latency (seconds) */
  preferred_max_latency?: number | {
    p50?: number;
    p75?: number;
    p90?: number;
    p99?: number;
  };
  /** Maximum pricing per 1M tokens */
  max_price?: {
    prompt?: number;
    completion?: number;
    request?: number;
    image?: number;
  };
  /** List of provider slugs to allow */
  only?: string[];
  /** List of provider slugs to skip */
  ignore?: string[];
  /** Quantization levels to filter by */
  quantizations?: string[];
}

/**
 * Model request options with fallback support.
 */
export interface ModelRequestOptions {
  /** Fallback model chain (OpenRouter tries in order) */
  fallbacks?: string[];
  /** Provider routing preferences */
  provider?: ProviderRoutingOptions;
}

// ============================================================================
// OpenRouter Configuration
// ============================================================================

/**
 * Optional headers for OpenRouter attribution.
 * These allow your app to appear on OpenRouter leaderboards.
 */
const getOpenRouterHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = {};

  // Site attribution (optional, for rankings on openrouter.ai)
  const siteUrl = process.env.OPENROUTER_SITE_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (siteUrl) {
    headers['HTTP-Referer'] = siteUrl;
  }

  // Site name (optional, shows in openrouter.ai rankings)
  const siteName = process.env.OPENROUTER_SITE_NAME || 'Sako Composer';
  if (siteName) {
    headers['X-OpenRouter-Title'] = siteName;
  }

  return headers;
};

/**
 * Default provider routing options.
 * Applied globally to all requests unless overridden.
 */
const DEFAULT_PROVIDER_OPTIONS: ProviderRoutingOptions = {
  allow_fallbacks: true,
  require_parameters: true,
  data_collection: 'deny',
  // Default: price-based load balancing (OpenRouter default)
  // Change to 'throughput' for nitro-like behavior
};

/**
 * Singleton OpenRouter provider with global settings.
 */
let openrouterInstance: OpenRouterProvider | null = null;

export function getOpenRouter(): OpenRouterProvider {
  if (!openrouterInstance) {
    if (!process.env.OPENROUTER_API_KEY) {
      throw new Error(
        'OPENROUTER_API_KEY is required. Get one at https://openrouter.ai/keys'
      );
    }

    openrouterInstance = createOpenRouter({
      apiKey: process.env.OPENROUTER_API_KEY,
      compatibility: 'strict',
      headers: getOpenRouterHeaders(),
      extraBody: {
        provider: DEFAULT_PROVIDER_OPTIONS,
      },
    });
  }
  return openrouterInstance;
}

// Default export for convenience
export const openrouter = new Proxy({} as OpenRouterProvider, {
  get(_target, prop) {
    return getOpenRouter()[prop as keyof OpenRouterProvider];
  },
});

// ============================================================================
// Model ID Constants (Mar 2026 - Latest & Greatest)
// ============================================================================

/**
 * Model IDs for OpenRouter (Mar 2026)
 *
 * THESE ARE THE ABSOLUTE BEST MODELS AVAILABLE RIGHT NOW.
 * Per latest-models-only.mdc allowlist.
 *
 * Model Suffix Shortcuts:
 * - `:nitro` - Sort by throughput (fastest)
 * - `:floor` - Sort by price (cheapest)
 *
 * @see https://openrouter.ai/models
 */
export const MODEL_IDS = {
  // ============================================================================
  // PRIMARY CHAT MODELS
  // ============================================================================

  /**
   * FAST - Quick validations, claim checks, short completions
   * GPT-5.3 Chat - 128K context, optimized for chat
   * Released: Mar 4, 2026 | $1.75/$14 per 1M
   */
  FAST: 'openai/gpt-5.3-chat',

  /**
   * BALANCED - HTML generation, general tasks, moderate complexity
   * GPT-5.4 - 1.05M context, best all-rounder
   * Released: Mar 5, 2026 | $2.50/$15 per 1M
   */
  BALANCED: 'openai/gpt-5.4',

  /**
   * CREATIVE - Marketing copy, design briefs, headlines, brand angles
   * Claude Sonnet 4.6 - 1M context, exceptional creative quality
   * Released: Feb 17, 2026 | $3/$15 per 1M
   * 499B weekly tokens - most popular creative model
   */
  CREATIVE: 'anthropic/claude-sonnet-4.6',

  /**
   * STRUCTURED - JSON/schema outputs, structured generation, tool calls
   * GPT-5.4 - 1.05M context, primary structured model
   * Fallbacks: Claude Sonnet 4.6 → Gemini 3.1 Pro Preview
   */
  STRUCTURED: 'openai/gpt-5.4',

  /**
   * REASONING - Complex multi-step planning, campaign strategy, deep analysis
   * Claude Opus 4.6 - 1M context, best reasoning capability
   * Fallbacks: Gemini 3.1 Pro Preview → GPT-5.4
   */
  REASONING: 'anthropic/claude-opus-4.6',

  // ============================================================================
  // SPECIALIZED MODELS
  // ============================================================================

  /**
   * MULTIMODAL - Image input, document parsing, visual design references
   * Gemini 3.1 Pro Preview - 1M context, handles images/docs
   * Released: Feb 19, 2026 | $2/$12 per 1M
   */
  MULTIMODAL: 'google/gemini-3.1-pro-preview',

  /**
   * CODE - Code generation, refactoring, technical tasks
   * GPT-5.4 - General model used for code (avoids expensive Codex)
   */
  CODE: 'openai/gpt-5.4',

  /**
   * PRO - Maximum capability when cost doesn't matter.
   * Note: Pro/Codex models excluded for cost; mirrors REASONING.
   */
  PRO: 'anthropic/claude-opus-4.6',

  // ============================================================================
  // THROUGHPUT-OPTIMIZED (Nitro variants)
  // ============================================================================

  /**
   * FAST_NITRO - Fast model with throughput prioritization
   * Appending :nitro is equivalent to sort: 'throughput'
   */
  FAST_NITRO: 'openai/gpt-5.3-chat:nitro',

  /**
   * BALANCED_NITRO - Balanced model with throughput prioritization
   */
  BALANCED_NITRO: 'openai/gpt-5.4:nitro',

  // ============================================================================
  // EMBEDDING MODELS
  // ============================================================================

  /**
   * EMBEDDING - Semantic memory, similarity search
   * text-embedding-3-large - Best quality embeddings
   */
  EMBEDDING: 'openai/text-embedding-3-large',

  /**
   * EMBEDDING_SMALL - Template retrieval, fast lookup
   * text-embedding-3-small - Fast, cheaper embeddings
   */
  EMBEDDING_SMALL: 'openai/text-embedding-3-small',

} as const;

export type ModelTier = keyof typeof MODEL_IDS;

// ============================================================================
// Fallback Chains (OpenRouter `models` array for auto-failover)
// ============================================================================

/**
 * Fallback chains for each tier.
 *
 * OpenRouter will automatically try the next model if primary fails.
 * Triggers: downtime, rate-limiting, moderation flags, context length errors.
 *
 * Pricing: Billed at rate of whichever model ultimately processed the request.
 *
 * @see https://openrouter.ai/docs/guides/routing/model-fallbacks
 */
export const FALLBACK_CHAINS: Record<string, string[]> = {
  FAST: [
    'openai/gpt-5.3-chat',
    'openai/gpt-5.4',
    'x-ai/grok-4.1-fast',
  ],
  BALANCED: [
    'openai/gpt-5.4',
    'google/gemini-3.1-pro-preview',
    'anthropic/claude-sonnet-4.6',
  ],
  CREATIVE: [
    'anthropic/claude-sonnet-4.6',
    'anthropic/claude-opus-4.6',
    'openai/gpt-5.4',
  ],
  STRUCTURED: [
    'openai/gpt-5.4',              // Primary
    'anthropic/claude-sonnet-4.6', // Backup
    'google/gemini-3.1-pro-preview',
  ],
  REASONING: [
    'anthropic/claude-opus-4.6',
    'google/gemini-3.1-pro-preview',
    'openai/gpt-5.4',
  ],
  MULTIMODAL: [
    'google/gemini-3.1-pro-preview',
    'anthropic/claude-opus-4.6',
    'openai/gpt-5.4',
  ],
  CODE: [
    'openai/gpt-5.4',              // Primary (general model for code)
    'x-ai/grok-4.1-fast',          // Fast code fallback
    'moonshotai/kimi-k2.5',        // High-quality code fallback
  ],
  PRO: [
    'anthropic/claude-opus-4.6',
    'google/gemini-3.1-pro-preview',
    'openai/gpt-5.4',
  ],
};

// ============================================================================
// DEPRECATED MODELS - Never Use These
// ============================================================================

/**
 * These model IDs are DEPRECATED and will fail.
 * Reject any code or config referencing them.
 */
export const DEPRECATED_MODELS = [
  'openai/gpt-4.1',              // Retired Feb 13, 2026
  'openai/gpt-4.1-mini',         // Retired Feb 13, 2026
  'openai/gpt-4o',               // Retired
  'openai/gpt-4',                // Retired
  'openai/gpt-5.2-pro',          // Removed from stack
  'openai/gpt-5.4-pro',          // Expensive - excluded from active use
  'openai/gpt-5.3-codex',       // Expensive - excluded from active use
  'openai/gpt-5.2-codex',       // Expensive - excluded from active use
  'anthropic/claude-3.5-sonnet', // Superseded
  'anthropic/claude-opus-4.5',   // Superseded by 4.6
  'anthropic/claude-sonnet-4.5', // Superseded by 4.6
  'anthropic/claude-haiku-4.5',  // Prefer gpt-5.3-chat or gemini-3.1-pro-preview
  'google/gemini-pro',           // Legacy
  'google/gemini-2.0-flash',     // Superseded
  'google/gemini-2.5-flash',     // Superseded by 3.1 family
  'xai/grok-4.1-fast-reasoning', // Typoed/legacy slug
  'meta/llama-4-maverick',       // Typoed/legacy slug
  'moonshotai/kimi-k2-turbo',    // Invalid variant
];

// ============================================================================
// User-Configurable Model Catalog
// ============================================================================

/**
 * Available models for user-configurable tiers.
 * Only models on the latest-models-only.mdc allowlist are included.
 *
 * STRUCTURED tier has a restricted list — only models with strong
 * JSON/tool-call reliability. No Anthropic/Meta/DeepSeek models.
 */
export const AVAILABLE_MODELS = [
  // ── FAST tier ─────────────────────────────────────────────────────────────
  {
    id: 'openai/gpt-5.3-chat',
    label: 'GPT-5.3 Chat',
    provider: 'OpenAI',
    tier: 'fast' as const,
    outputPricePerM: 14.00,
    contextK: 128,
    isDefault: true,
    isPreview: false,
    strengths: ['Fast responses', 'Tool calls', 'Quick validations'],
  },
  {
    id: 'x-ai/grok-4.1-fast',
    label: 'Grok 4.1 Fast',
    provider: 'xAI',
    tier: 'fast' as const,
    outputPricePerM: 0.50,
    contextK: 2000,
    isDefault: false,
    isPreview: false,
    strengths: ['Ultra-fast', 'Agentic tool calls', 'Bulk ops'],
  },
  {
    id: 'deepseek/deepseek-v3.2',
    label: 'DeepSeek V3.2',
    provider: 'DeepSeek',
    tier: 'fast' as const,
    outputPricePerM: 0.28,
    contextK: 128,
    isDefault: false,
    isPreview: false,
    strengths: ['Lowest cost', 'Bulk operations', 'High throughput'],
  },
  // ── BALANCED tier ─────────────────────────────────────────────────────────
  {
    id: 'openai/gpt-5.4',
    label: 'GPT-5.4',
    provider: 'OpenAI',
    tier: 'balanced' as const,
    outputPricePerM: 15.00,
    contextK: 400,
    isDefault: true,
    isPreview: false,
    strengths: ['Structured JSON', 'HTML generation', 'Reliable outputs'],
  },
  {
    id: 'google/gemini-3.1-pro-preview',
    label: 'Gemini 3.1 Pro',
    provider: 'Google',
    tier: 'balanced' as const,
    outputPricePerM: 8.00,
    contextK: 1000,
    isDefault: false,
    isPreview: true,
    strengths: ['Multimodal', 'Lower cost', 'Large context'],
  },
  {
    id: 'meta-llama/llama-4-scout',
    label: 'Llama 4 Scout',
    provider: 'Meta',
    tier: 'balanced' as const,
    outputPricePerM: 0.70,
    contextK: 10000,
    isDefault: false,
    isPreview: false,
    strengths: ['10M context', 'Multilingual', 'Open source'],
  },
  // ── CREATIVE tier ─────────────────────────────────────────────────────────
  {
    id: 'anthropic/claude-sonnet-4.6',
    label: 'Claude Sonnet 4.6',
    provider: 'Anthropic',
    tier: 'creative' as const,
    outputPricePerM: 15.00,
    contextK: 1000,
    isDefault: true,
    isPreview: false,
    strengths: ['Marketing copy', 'Brand voice', 'Instruction following'],
  },
  {
    id: 'anthropic/claude-opus-4.6',
    label: 'Claude Opus 4.6',
    provider: 'Anthropic',
    tier: 'creative' as const,
    outputPricePerM: 25.00,
    contextK: 1000,
    isDefault: false,
    isPreview: false,
    strengths: ['Highest quality', 'Complex narratives', 'Brand precision'],
  },
  {
    id: 'openai/gpt-5.4',
    label: 'GPT-5.4',
    provider: 'OpenAI',
    tier: 'creative' as const,
    outputPricePerM: 15.00,
    contextK: 400,
    isDefault: false,
    isPreview: false,
    strengths: ['Consistent format', 'Reliable', 'Lower cost'],
  },
  {
    id: 'deepseek/deepseek-v3.2',
    label: 'DeepSeek V3.2',
    provider: 'DeepSeek',
    tier: 'creative' as const,
    outputPricePerM: 0.28,
    contextK: 128,
    isDefault: false,
    isPreview: false,
    strengths: ['Bulk copy', 'High throughput', 'Lowest cost'],
    note: 'Best for bulk variants and drafts — not recommended for brand-critical copy',
  },
  // ── REASONING tier ────────────────────────────────────────────────────────
  {
    id: 'anthropic/claude-opus-4.6',
    label: 'Claude Opus 4.6',
    provider: 'Anthropic',
    tier: 'reasoning' as const,
    outputPricePerM: 25.00,
    contextK: 1000,
    isDefault: true,
    isPreview: false,
    strengths: ['Complex planning', 'Deep analysis', 'Multi-step tasks'],
  },
  {
    id: 'google/gemini-3.1-pro-preview',
    label: 'Gemini 3.1 Pro',
    provider: 'Google',
    tier: 'reasoning' as const,
    outputPricePerM: 12.00,
    contextK: 1000,
    isDefault: false,
    isPreview: true,
    strengths: ['Highest intelligence', 'Lower cost', 'Large context'],
  },
  {
    id: 'x-ai/grok-4',
    label: 'Grok 4',
    provider: 'xAI',
    tier: 'reasoning' as const,
    outputPricePerM: 10.00,
    contextK: 256,
    isDefault: false,
    isPreview: false,
    strengths: ['Heavy reasoning', 'Research tasks', 'Deep thinking'],
  },
  // ── STRUCTURED tier (Advanced Mode only — restricted list) ─────────────────
  // Only models with strong tool-call/JSON reliability.
  // No Anthropic, Meta, or DeepSeek models in this tier.
  {
    id: 'openai/gpt-5.4',
    label: 'GPT-5.4',
    provider: 'OpenAI',
    tier: 'structured' as const,
    outputPricePerM: 15.00,
    contextK: 1050,
    isDefault: true,
    isPreview: false,
    strengths: ['Best JSON reliability', 'Zod-compatible', 'Tool calls'],
  },
  {
    id: 'x-ai/grok-4.1-fast',
    label: 'Grok 4.1 Fast',
    provider: 'xAI',
    tier: 'structured' as const,
    outputPricePerM: 0.50,
    contextK: 2000,
    isDefault: false,
    isPreview: false,
    strengths: ['Fastest schema output', 'Agentic tool calls', 'Lower cost'],
  },
  {
    id: 'google/gemini-3.1-pro-preview',
    label: 'Gemini 3.1 Pro',
    provider: 'Google',
    tier: 'structured' as const,
    outputPricePerM: 8.00,
    contextK: 1000,
    isDefault: false,
    isPreview: true,
    strengths: ['Structured outputs', 'Multimodal', 'Large context'],
  },
] as const

export type AvailableModel = typeof AVAILABLE_MODELS[number] & { note?: string }

export type UserControllableTier = 'fast' | 'balanced' | 'creative' | 'reasoning' | 'structured'

export interface ModelPreferences {
  fast?: string
  balanced?: string
  creative?: string
  reasoning?: string
  structured?: string
}

/**
 * Returns the default model ID for a controllable tier.
 * AVAILABLE_MODELS is the single source of truth for defaults — changing
 * isDefault here propagates everywhere without touching MODEL_IDS.
 */
export function getDefaultModelId(tier: UserControllableTier): string {
  const model = AVAILABLE_MODELS.find(m => m.tier === tier && m.isDefault)
  // Falls back to first model in tier if no default found (should never happen)
  return model?.id ?? AVAILABLE_MODELS.find(m => m.tier === tier)!.id
}

/** Returns all available models for a specific tier */
export function getModelsForTier(tier: UserControllableTier): AvailableModel[] {
  return AVAILABLE_MODELS.filter(m => m.tier === tier) as AvailableModel[]
}

/** Returns true if modelId is a valid choice for the given tier */
export function isValidModelForTier(modelId: string, tier: UserControllableTier): boolean {
  return AVAILABLE_MODELS.some(m => m.id === modelId && m.tier === tier)
}

/**
 * Estimated cost per 1K output tokens for a model.
 * Returns 0 if model is not in the catalog.
 */
export function estimateCostPer1KOutput(modelId: string): number {
  const model = AVAILABLE_MODELS.find(m => m.id === modelId)
  if (!model) return 0
  return model.outputPricePerM / 1000
}

/**
 * Returns the effective model ID for a tier, applying user preference if valid.
 * Falls back to getDefaultModelId() — AVAILABLE_MODELS is the single source of
 * truth for defaults. Never throws — generation must never fail due to a bad preference.
 */
export function getEffectiveModelId(
  tier: UserControllableTier,
  prefs?: ModelPreferences | null,
): string {
  const override = prefs?.[tier]
  if (override && isValidModelForTier(override, tier)) {
    return override
  }
  // AVAILABLE_MODELS is authoritative — not MODEL_IDS — so changing a default
  // in the catalog propagates automatically without a second constant to update.
  return getDefaultModelId(tier)
}

// ============================================================================
// Model Resolution Helpers
// ============================================================================

/**
 * Resolve a model ID string to an OpenRouter chat model.
 *
 * @param modelId - Either a tier name (e.g., 'FAST') or full model ID
 */
export function resolveModel(modelId: string | ModelTier) {
  const id = MODEL_IDS[modelId as ModelTier] || modelId;

  // Check for deprecated models
  if (DEPRECATED_MODELS.includes(id)) {
    console.warn(`⚠️ DEPRECATED MODEL: ${id} - using fallback`);
    return getOpenRouter()(MODEL_IDS.BALANCED);
  }

  return getOpenRouter()(id);
}

/**
 * Resolve a model ID string to an OpenRouter embedding model.
 *
 * @param modelId - Either 'EMBEDDING', 'EMBEDDING_SMALL', or full model ID
 */
export function resolveEmbeddingModel(modelId: string | 'EMBEDDING' | 'EMBEDDING_SMALL') {
  const id = MODEL_IDS[modelId as 'EMBEDDING' | 'EMBEDDING_SMALL'] || modelId;
  return getOpenRouter().textEmbeddingModel(id);
}

/**
 * Get a model with fallback chain for automatic failover.
 *
 * Uses OpenRouter's `models` array parameter for automatic fallback.
 * If the primary model fails, OpenRouter will try the next in the list.
 *
 * @param tier - Model tier (FAST, BALANCED, etc.)
 * @see https://openrouter.ai/docs/guides/routing/model-fallbacks
 */
export function getModelWithFallback(tier: keyof typeof FALLBACK_CHAINS) {
  const fallbacks = FALLBACK_CHAINS[tier];
  const primary = fallbacks[0];

  return getOpenRouter()(primary, {
    extraBody: {
      models: fallbacks, // OpenRouter fallback array
      provider: DEFAULT_PROVIDER_OPTIONS,
    },
  });
}

/**
 * Get a model with throughput prioritization (Nitro mode).
 * Equivalent to appending :nitro to model slug.
 *
 * @param modelId - Model ID or tier
 */
export function getModelNitro(modelId: string | ModelTier) {
  const id = MODEL_IDS[modelId as ModelTier] || modelId;

  return getOpenRouter()(id, {
    extraBody: {
      provider: {
        ...DEFAULT_PROVIDER_OPTIONS,
        sort: 'throughput',
      },
    },
  });
}

/**
 * Get a model with price prioritization (Floor mode).
 * Equivalent to appending :floor to model slug.
 *
 * @param modelId - Model ID or tier
 */
export function getModelFloor(modelId: string | ModelTier) {
  const id = MODEL_IDS[modelId as ModelTier] || modelId;

  return getOpenRouter()(id, {
    extraBody: {
      provider: {
        ...DEFAULT_PROVIDER_OPTIONS,
        sort: 'price',
      },
    },
  });
}

/**
 * Get a model with custom provider preferences.
 *
 * @param modelId - Model ID string
 * @param options - Provider routing options
 * @see https://openrouter.ai/docs/features/model-routing
 */
export function getModelWithOptions(
  modelId: string,
  options?: ModelRequestOptions
) {
  return getOpenRouter()(modelId, {
    extraBody: {
      models: options?.fallbacks,
      provider: {
        ...DEFAULT_PROVIDER_OPTIONS,
        ...options?.provider,
      },
    },
  });
}

/**
 * Get a model with performance thresholds.
 * Useful for real-time applications requiring consistent latency.
 *
 * @param modelId - Model ID or tier
 * @param thresholds - Performance requirements
 * @see https://openrouter.ai/docs/features/model-routing#performance-thresholds
 */
export function getModelWithPerformanceThresholds(
  modelId: string | ModelTier,
  thresholds: {
    minThroughput?: number | { p50?: number; p75?: number; p90?: number; p99?: number };
    maxLatency?: number | { p50?: number; p75?: number; p90?: number; p99?: number };
  }
) {
  const id = MODEL_IDS[modelId as ModelTier] || modelId;

  return getOpenRouter()(id, {
    extraBody: {
      provider: {
        ...DEFAULT_PROVIDER_OPTIONS,
        preferred_min_throughput: thresholds.minThroughput,
        preferred_max_latency: thresholds.maxLatency,
      },
    },
  });
}

// ============================================================================
// Plugin Configuration
// ============================================================================

/**
 * Plugin configuration for different call types.
 */
export const PLUGIN_CONFIGS = {
  /**
   * Default plugins for structured/generateObject calls.
   * response-healing: Auto-fix malformed JSON responses
   */
  structured: [
    { id: 'response-healing' },
  ],

  /**
   * No plugins for streaming calls (response-healing doesn't apply)
   */
  streaming: [],

  /**
   * Optional plugins (can be enabled via settings)
   */
  optional: {
    web: { id: 'web' },
    fileParser: { id: 'file-parser' },
    moderation: { id: 'moderation' },
    autoRouter: { id: 'auto-router' },
  },
} as const;

// ============================================================================
// Health Check
// ============================================================================

/**
 * Check if OpenRouter is configured and accessible.
 */
export async function checkOpenRouterHealth(): Promise<{
  healthy: boolean;
  error?: string;
  modelCount?: number;
}> {
  try {
    if (!process.env.OPENROUTER_API_KEY) {
      return { healthy: false, error: 'OPENROUTER_API_KEY not set' };
    }

    const response = await fetch('https://openrouter.ai/api/v1/models', {
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      return {
        healthy: false,
        error: `OpenRouter API returned ${response.status}`,
      };
    }

    const data = await response.json();
    return {
      healthy: true,
      modelCount: data.data?.length || 0,
    };
  } catch (error) {
    return {
      healthy: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
