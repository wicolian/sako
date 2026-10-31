/**
 * LangSmith + Vercel AI SDK + OpenRouter Integration (Feb 2026)
 *
 * When LANGSMITH_API_KEY is set, wraps the AI SDK so generateText, streamText,
 * generateObject, and streamObject are traced in LangSmith.
 *
 * All model strings are resolved through OpenRouter provider.
 * Global system prompt is automatically prepended from workspace/env settings.
 *
 * Set in .env: LANGSMITH_TRACING=true, LANGSMITH_ENDPOINT, LANGSMITH_API_KEY, LANGSMITH_PROJECT
 * See: https://sdk.vercel.ai/providers/observability/langsmith
 */

import * as ai from 'ai';
import { wrapAISDK } from 'langsmith/experimental/vercel';
import {
  getOpenRouter,
  MODEL_IDS,
  type ModelTier,
  getEffectiveModelId,
  type UserControllableTier,
} from './openrouter';
import {
  getAIContext,
  getGlobalSystemPrompt,
  getPluginConfig,
  getRoutingConfig,
} from './context';
import { maybeRecordResponsesSessionTurn } from './openai-responses-session';

interface TransportAwareOptions {
  transportMode?: 'openrouter' | 'openai_responses_session'
  model: unknown
  system?: unknown
  prompt?: unknown
}

// Map LANGSMITH_* to LANGCHAIN_* so the LangSmith SDK picks up config
if (process.env.LANGSMITH_API_KEY && !process.env.LANGCHAIN_API_KEY) {
  process.env.LANGCHAIN_TRACING_V2 = process.env.LANGSMITH_TRACING ?? 'true';
  process.env.LANGCHAIN_API_KEY = process.env.LANGSMITH_API_KEY;
  process.env.LANGCHAIN_PROJECT = process.env.LANGCHAIN_PROJECT ?? process.env.LANGSMITH_PROJECT ?? 'sako';
  process.env.LANGCHAIN_ENDPOINT = process.env.LANGCHAIN_ENDPOINT ?? process.env.LANGSMITH_ENDPOINT ?? 'https://api.smith.langchain.com';
}

const wrapped = wrapAISDK(ai);

// ============================================================================
// Model Resolution
// ============================================================================

/**
 * The tiers that are user-configurable via ModelPreferences.
 * EMBEDDING, CODE, MULTIMODAL, etc. are NOT user-configurable.
 */
const CONTROLLABLE_TIER_KEYS = new Set<string>([
  'FAST', 'BALANCED', 'CREATIVE', 'REASONING', 'STRUCTURED',
])

/**
 * Resolve a model ID or tier to an OpenRouter model instance.
 * Applies workspace model preferences (from AIContext) before falling back to MODEL_IDS defaults.
 */
function resolveModel(model: unknown, callType: 'text' | 'structured' = 'text'): unknown {
  if (typeof model === 'string') {
    const context = getAIContext()
    const routing = getRoutingConfig()
    const plugins = getPluginConfig(callType)
    const openrouter = getOpenRouter()

    let modelId: string

    // Apply user preferences for controllable tiers (FAST, BALANCED, CREATIVE, REASONING, STRUCTURED)
    // Non-controllable tiers (EMBEDDING, CODE, MULTIMODAL, etc.) pass through unchanged
    if (CONTROLLABLE_TIER_KEYS.has(model) && context?.modelPreferences) {
      modelId = getEffectiveModelId(
        model.toLowerCase() as UserControllableTier,
        context.modelPreferences,
      )
    } else {
      modelId = MODEL_IDS[model as ModelTier] || model
    }

    return openrouter(modelId, {
      extraBody: {
        provider: {
          allow_fallbacks: routing.allow_fallbacks,
          require_parameters: routing.require_parameters,
          data_collection: routing.data_collection,
          sort: routing.sort,
          order: routing.order ?? context?.settings?.routing?.order,
          max_price: routing.max_price,
        },
        plugins,
      },
    })
  }
  return model
}

/**
 * Resolve embedding model ID to OpenRouter embedding model.
 */
function resolveEmbeddingModel(model: unknown): unknown {
  if (typeof model === 'string') {
    const modelId = MODEL_IDS[model as 'EMBEDDING' | 'EMBEDDING_SMALL'] || model;
    return getOpenRouter().textEmbeddingModel(modelId);
  }
  return model;
}

/**
 * Merge global system prompt with call-specific system prompt.
 */
function mergeSystemPromptWithGlobal(callSystemPrompt?: unknown): unknown {
  const globalPrompt = getGlobalSystemPrompt();
  if (!globalPrompt) return callSystemPrompt;
  if (typeof callSystemPrompt === 'string') {
    return `${globalPrompt}\n\n---\n\n${callSystemPrompt}`;
  }
  if (!callSystemPrompt) return globalPrompt;
  return callSystemPrompt;
}

// ============================================================================
// Wrapped Exports with Global Prompt + Model Resolution
// ============================================================================

/**
 * Generate text with OpenRouter model resolution and global prompt.
 */
export async function generateText(options: any): Promise<any> {
  await maybeRecordResponsesSessionTurn(options as TransportAwareOptions);
  const resolvedModel = resolveModel(options.model, 'text');
  const mergedSystem = mergeSystemPromptWithGlobal(options.system);

  return wrapped.generateText({
    ...options,
    model: resolvedModel,
    system: mergedSystem,
  });
}

/**
 * Stream text with OpenRouter model resolution and global prompt.
 */
export function streamText(options: any): any {
  void maybeRecordResponsesSessionTurn(options as TransportAwareOptions);
  const resolvedModel = resolveModel(options.model, 'text');
  const mergedSystem = mergeSystemPromptWithGlobal(options.system);

  return wrapped.streamText({
    ...options,
    model: resolvedModel,
    system: mergedSystem,
  });
}

/**
 * Generate structured object with OpenRouter model resolution, global prompt,
 * and response-healing plugin by default.
 */
export async function generateObject<T = unknown>(options: any): Promise<{ object: T }> {
  await maybeRecordResponsesSessionTurn(options as TransportAwareOptions);
  const resolvedModel = resolveModel(options.model, 'structured');
  const mergedSystem = mergeSystemPromptWithGlobal(options.system);

  return wrapped.generateObject({
    ...options,
    model: resolvedModel,
    system: mergedSystem,
  });
}

/**
 * Stream structured object with OpenRouter model resolution and global prompt.
 */
export function streamObject<T = unknown>(options: any): any {
  void maybeRecordResponsesSessionTurn(options as TransportAwareOptions);
  const resolvedModel = resolveModel(options.model, 'structured');
  const mergedSystem = mergeSystemPromptWithGlobal(options.system);

  return wrapped.streamObject({
    ...options,
    model: resolvedModel,
    system: mergedSystem,
  });
}

/**
 * Generate embedding with OpenRouter model resolution.
 */
export async function embed(options: any): Promise<any> {
  const resolvedModel = resolveEmbeddingModel(options.model);

  return ai.embed({
    ...options,
    model: resolvedModel,
  });
}

/**
 * Generate embeddings for multiple texts with OpenRouter model resolution.
 */
export async function embedMany(options: any): Promise<any> {
  const resolvedModel = resolveEmbeddingModel(options.model);

  return ai.embedMany({
    ...options,
    model: resolvedModel,
  });
}

// ============================================================================
// Re-export Raw Functions (for edge cases)
// ============================================================================

export const rawGenerateText = ai.generateText;
export const rawStreamText = ai.streamText;
export const rawGenerateObject = ai.generateObject;
export const rawStreamObject = ai.streamObject;
