/**
 * OpenRouter Model Catalog (Feb 2026)
 *
 * Dynamically fetches and caches available models from OpenRouter.
 * Filters for 2026 models and selects best defaults by capability.
 *
 * Features:
 * - TTL-based caching (default: 6 hours)
 * - Filters by creation date for "latest" strategy
 * - Ranks by capabilities (tools, structured output, etc.)
 * - Falls back to static MODEL_IDS if API fails
 *
 * @see https://openrouter.ai/api/v1/models
 */

import { MODEL_IDS, type ModelTier } from './openrouter';

// ============================================================================
// Types
// ============================================================================

interface OpenRouterModel {
  id: string;
  name: string;
  description?: string;
  context_length: number;
  pricing: {
    prompt: string;
    completion: string;
    image?: string;
    request?: string;
  };
  top_provider?: {
    max_completion_tokens?: number;
  };
  architecture?: {
    modality: string;
    tokenizer: string;
    instruct_type?: string;
  };
  created: number; // Unix timestamp
  per_request_limits?: Record<string, number>;
}

interface OpenRouterModelsResponse {
  data: OpenRouterModel[];
}

interface ModelCapabilities {
  supportsTools: boolean;
  supportsStructuredOutput: boolean;
  supportsVision: boolean;
  supportsEmbedding: boolean;
}

interface ScoredModel {
  id: string;
  score: number;
  capabilities: ModelCapabilities;
  price: { prompt: number; completion: number };
  created: number;
}

// ============================================================================
// Configuration
// ============================================================================

const OPENROUTER_MODELS_URL = 'https://openrouter.ai/api/v1/models';

// TTL for cached models (default: 6 hours in seconds)
const CACHE_TTL_SECONDS = parseInt(
  process.env.OPENROUTER_MODELS_TTL_SEC || '21600',
  10
);

// 2026 date range for "latest" filtering
const YEAR_2026_START = new Date('2026-01-01T00:00:00Z').getTime() / 1000;
const YEAR_2026_END = new Date('2026-12-31T23:59:59Z').getTime() / 1000;

// ============================================================================
// Cache
// ============================================================================

interface CachedCatalog {
  timestamp: number;
  models: ScoredModel[];
  tierDefaults: Record<ModelTier, string>;
}

let cachedCatalog: CachedCatalog | null = null;

// ============================================================================
// Model Fetching
// ============================================================================

/**
 * Fetch models from OpenRouter API.
 */
async function fetchModels(): Promise<OpenRouterModel[]> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY not set');
  }

  const response = await fetch(OPENROUTER_MODELS_URL, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    throw new Error(`OpenRouter API returned ${response.status}`);
  }

  const data: OpenRouterModelsResponse = await response.json();
  return data.data;
}

/**
 * Detect model capabilities from model ID and metadata.
 */
function detectCapabilities(model: OpenRouterModel): ModelCapabilities {
  const id = model.id.toLowerCase();
  const name = model.name.toLowerCase();
  const modality = model.architecture?.modality?.toLowerCase() || '';

  // Embedding detection
  const isEmbedding =
    modality.includes('embedding') ||
    id.includes('embedding') ||
    id.includes('embed');

  // Tool calling support (most chat models support this)
  const supportsTools =
    !isEmbedding &&
    (id.includes('gpt') ||
      id.includes('claude') ||
      id.includes('gemini') ||
      id.includes('llama') ||
      id.includes('deepseek') ||
      id.includes('mistral'));

  // Structured output support
  const supportsStructuredOutput =
    supportsTools &&
    (id.includes('gpt') ||
      id.includes('claude') ||
      id.includes('gemini') ||
      id.includes('deepseek'));

  // Vision support
  const supportsVision =
    !isEmbedding &&
    (modality.includes('image') ||
      id.includes('vision') ||
      id.includes('gemini') ||
      id.includes('claude-3') ||
      id.includes('claude-sonnet') ||
      id.includes('claude-opus') ||
      id.includes('gpt-4') ||
      id.includes('gpt-5'));

  return {
    supportsTools,
    supportsStructuredOutput,
    supportsVision,
    supportsEmbedding: isEmbedding,
  };
}

/**
 * Score a model for a given tier.
 * Higher score = better fit.
 */
function scoreModelForTier(
  model: ScoredModel,
  tier: ModelTier
): number {
  const { capabilities, price, created } = model;

  // Base score from recency (prefer 2026 models)
  let score = 0;
  if (created >= YEAR_2026_START && created <= YEAR_2026_END) {
    score += 100; // Bonus for 2026 models
  }

  // Tier-specific scoring
  switch (tier) {
    case 'FAST':
      // Cheap and fast
      score -= price.prompt * 5;
      score += capabilities.supportsTools ? 30 : 0;
      // Prefer gpt-5.3-chat for fast
      if (model.id.includes('gpt-5.3-chat')) score += 50;
      break;

    case 'BALANCED':
      // Good balance of quality and cost
      score -= price.prompt * 3;
      score += capabilities.supportsStructuredOutput ? 30 : 0;
      score += capabilities.supportsTools ? 20 : 0;
      // Prefer gpt-5.4 for balanced
      if (model.id.includes('gpt-5.4') && !model.id.includes('pro')) score += 50;
      break;

    case 'CREATIVE':
      // High quality for creative tasks
      score += capabilities.supportsStructuredOutput ? 30 : 0;
      score += capabilities.supportsTools ? 20 : 0;
      // Prefer Claude Sonnet 4.6 for creative
      if (model.id.includes('claude-sonnet-4.6')) score += 80;
      break;

    case 'STRUCTURED':
      // Must support structured output
      if (!capabilities.supportsStructuredOutput) return -1;
      score += 50;
      // Prefer GPT-5.4 for structured (Codex excluded for cost)
      if (model.id.includes('gpt-5.4') && !model.id.includes('pro')) score += 80;
      break;

    case 'REASONING':
      // High quality for complex reasoning
      score += capabilities.supportsStructuredOutput ? 30 : 0;
      score += capabilities.supportsTools ? 20 : 0;
      // Prefer Claude Opus 4.6 for reasoning
      if (model.id.includes('claude-opus-4.6')) score += 80;
      break;

    case 'MULTIMODAL':
      // Must support vision
      if (!capabilities.supportsVision) return -1;
      score += 50;
      // Prefer Gemini 3.1 Pro for multimodal
      if (model.id.includes('gemini-3.1-pro')) score += 60;
      break;

    case 'CODE':
      // Code generation (Codex excluded for cost - use GPT-5.4)
      score += capabilities.supportsStructuredOutput ? 30 : 0;
      if (model.id.includes('gpt-5.4') && !model.id.includes('pro')) score += 80;
      break;

    case 'PRO':
      // Maximum capability (Pro excluded for cost - use Claude Opus)
      score += 100;
      if (model.id.includes('claude-opus-4.6')) score += 80;
      break;

    case 'EMBEDDING':
    case 'EMBEDDING_SMALL':
      // Must be an embedding model
      if (!capabilities.supportsEmbedding) return -1;
      score -= price.prompt * 100; // Strongly prefer cheaper
      break;
  }

  return score;
}

/**
 * Parse pricing string to number (per 1M tokens).
 */
function parsePrice(priceStr: string): number {
  const num = parseFloat(priceStr);
  if (isNaN(num)) return 0;
  // OpenRouter returns price per token, multiply by 1M
  return num * 1_000_000;
}

/**
 * Process and score all models.
 */
function processModels(models: OpenRouterModel[]): ScoredModel[] {
  return models.map((model) => ({
    id: model.id,
    score: 0,
    capabilities: detectCapabilities(model),
    price: {
      prompt: parsePrice(model.pricing.prompt),
      completion: parsePrice(model.pricing.completion),
    },
    created: model.created,
  }));
}

/**
 * Select best model for each tier.
 */
function selectTierDefaults(scoredModels: ScoredModel[]): Record<ModelTier, string> {
  const tiers: ModelTier[] = [
    'FAST',
    'BALANCED',
    'CREATIVE',
    'STRUCTURED',
    'REASONING',
    'MULTIMODAL',
    'CODE',
    'PRO',
    'EMBEDDING',
    'EMBEDDING_SMALL',
  ];

  const defaults: Record<ModelTier, string> = { ...MODEL_IDS };

  for (const tier of tiers) {
    // Filter models that score positively for this tier
    const candidates = scoredModels
      .map((m) => ({ ...m, score: scoreModelForTier(m, tier) }))
      .filter((m) => m.score > 0)
      .sort((a, b) => b.score - a.score);

    if (candidates.length > 0) {
      defaults[tier] = candidates[0].id;
    }
    // Otherwise keep the fallback from MODEL_IDS
  }

  return defaults;
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Get the model catalog, fetching if needed.
 * Returns cached data if fresh, otherwise fetches new data.
 */
export async function getModelCatalog(): Promise<{
  models: ScoredModel[];
  tierDefaults: Record<ModelTier, string>;
  fresh: boolean;
}> {
  const now = Date.now() / 1000;

  // Check cache
  if (cachedCatalog && cachedCatalog.timestamp + CACHE_TTL_SECONDS > now) {
    return {
      models: cachedCatalog.models,
      tierDefaults: cachedCatalog.tierDefaults,
      fresh: true,
    };
  }

  // Fetch new data
  try {
    const models = await fetchModels();
    const scoredModels = processModels(models);
    const tierDefaults = selectTierDefaults(scoredModels);

    // Update cache
    cachedCatalog = {
      timestamp: now,
      models: scoredModels,
      tierDefaults,
    };

    return {
      models: scoredModels,
      tierDefaults,
      fresh: true,
    };
  } catch (error) {
    console.warn('Failed to fetch OpenRouter model catalog:', error);

    // Return cached data if available, even if stale
    if (cachedCatalog) {
      return {
        models: cachedCatalog.models,
        tierDefaults: cachedCatalog.tierDefaults,
        fresh: false,
      };
    }

    // Fall back to static MODEL_IDS
    return {
      models: [],
      tierDefaults: MODEL_IDS,
      fresh: false,
    };
  }
}

/**
 * Get the best model ID for a tier.
 * Uses dynamic catalog if available, falls back to MODEL_IDS.
 */
export async function getBestModelForTier(tier: ModelTier): Promise<string> {
  const { tierDefaults } = await getModelCatalog();
  return tierDefaults[tier];
}

/**
 * Get all available models with their capabilities.
 */
export async function getAvailableModels(): Promise<ScoredModel[]> {
  const { models } = await getModelCatalog();
  return models;
}

/**
 * Check if a model ID exists in the catalog.
 */
export async function isModelAvailable(modelId: string): Promise<boolean> {
  const { models } = await getModelCatalog();
  return models.some((m) => m.id === modelId);
}

/**
 * Force refresh the catalog.
 */
export async function refreshCatalog(): Promise<void> {
  cachedCatalog = null;
  await getModelCatalog();
}

/**
 * Get cache status.
 */
export function getCatalogStatus(): {
  cached: boolean;
  timestamp: number | null;
  ageSeconds: number | null;
  ttlSeconds: number;
} {
  const now = Date.now() / 1000;

  return {
    cached: cachedCatalog !== null,
    timestamp: cachedCatalog?.timestamp ?? null,
    ageSeconds: cachedCatalog ? now - cachedCatalog.timestamp : null,
    ttlSeconds: CACHE_TTL_SECONDS,
  };
}
