/**
 * Model Router (Feb 2026)
 *
 * Returns model string IDs for use with Vercel AI SDK v6 + OpenRouter.
 * All model strings are resolved through OpenRouter provider.
 *
 * Per latest-models-only.mdc - Hard allowlist enforcement.
 *
 * IMPORTANT: Do NOT use direct provider SDKs (@ai-sdk/openai, @ai-sdk/anthropic).
 * Just pass model strings to the AI SDK functions and OpenRouter handles routing.
 */

// Allowed model IDs (Mar 2026 - Latest OpenRouter models)
// Note: gpt-*pro and *codex models excluded for cost
const ALLOWED_MODELS = new Set([
  // OpenAI GPT-5 family (LATEST!)
  'openai/gpt-5.4',           // Mar 5, 2026 - 1.05M context
  'openai/gpt-5.3-chat',      // Mar 4, 2026 - Fast chat
  'openai/gpt-5.2',           // Dec 10, 2025 - 400K context (legacy fallback)
  'openai/gpt-5.2-chat',      // Dec 10, 2025 - 128K context (legacy fallback)

  // Anthropic Claude 4.6 family (LATEST!)
  'anthropic/claude-opus-4.6',   // Feb 4, 2026 - Best reasoning
  'anthropic/claude-sonnet-4.6', // Feb 17, 2026 - Best creative

  // Google Gemini 3.1 family
  'google/gemini-3.1-pro-preview',              // Feb 19, 2026 - 1M context, multimodal
  'google/gemini-3.1-pro-preview-customtools',  // Feb 26, 2026 - Tools-optimized

  // DeepSeek
  'deepseek/deepseek-v3.2',
  'deepseek/deepseek-v3.2-thinking',

  // xAI
  'x-ai/grok-4.1-fast',
  'x-ai/grok-4',

  // Meta
  'meta-llama/llama-4-maverick',
  'meta-llama/llama-4-scout',

  // Moonshot
  'moonshotai/kimi-k2.5',
  'moonshotai/kimi-k2',
  'moonshotai/kimi-k2-thinking',

  // Embeddings
  'openai/text-embedding-3-large',
  'openai/text-embedding-3-small',
])

/**
 * Validate and return a model string ID for use with AI SDK + OpenRouter
 *
 * Usage with AI SDK 6.x + OpenRouter:
 * ```ts
 * const result = await generateText({
 *   model: getModel('openai/gpt-5.2-chat'),
 *   prompt: '...'
 * })
 * ```
 */
export function getModel(modelId: string): string {
  if (!ALLOWED_MODELS.has(modelId)) {
    console.warn(`Model ${modelId} not in allowlist, defaulting to openai/gpt-5.3-chat`)
    return 'openai/gpt-5.3-chat'
  }
  return modelId
}

/**
 * Get model ID for specific use cases
 */
export function getModelForTask(task: 'creative' | 'fast' | 'structured' | 'reasoning'): string {
  const modelMap: Record<typeof task, string> = {
    creative: 'anthropic/claude-sonnet-4.6',
    fast: 'openai/gpt-5.3-chat',
    structured: 'openai/gpt-5.4',
    reasoning: 'openai/gpt-5.4-pro',
  }
  return getModel(modelMap[task])
}

/**
 * Model configuration for common tasks
 * These match the MODELS export in ai-sdk-client.ts
 *
 */
export const MODELS = {
  // For structured outputs (JSON, schemas)
  STRUCTURED: 'openai/gpt-5.4' as const,

  // For creative content (copy, headlines) - 1M context
  CREATIVE: 'anthropic/claude-sonnet-4.6' as const,

  // For fast responses (simple queries)
  FAST: 'openai/gpt-5.3-chat' as const,

  // For complex reasoning - 1M context
  REASONING: 'openai/gpt-5.4-pro' as const,

  // For balanced tasks - 400K context
  BALANCED: 'openai/gpt-5.4' as const,

  // Embeddings
  EMBEDDING: 'openai/text-embedding-3-large' as const,
  EMBEDDING_SMALL: 'openai/text-embedding-3-small' as const,
} as const

/**
 * Check if a model ID is in the allowlist
 */
export function isModelAllowed(modelId: string): boolean {
  return ALLOWED_MODELS.has(modelId)
}

/**
 * Get all allowed model IDs
 */
export function getAllowedModels(): string[] {
  return Array.from(ALLOWED_MODELS)
}
