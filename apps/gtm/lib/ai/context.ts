/**
 * AI Context Module (Feb 2026)
 *
 * Provides workspace-level AI settings via AsyncLocalStorage.
 * This allows the global system prompt and other settings to be
 * applied automatically to all AI calls within a workspace context.
 *
 * Usage:
 * ```ts
 * import { withAIContext, getAIContext } from '@/lib/ai/context';
 *
 * // In a route handler:
 * await withAIContext({ workspaceId }, async () => {
 *   // All AI calls here will have workspace settings applied
 *   const result = await generateText({ ... });
 * });
 * ```
 */

import { AsyncLocalStorage } from 'async_hooks';
import type { ModelPreferences } from './openrouter';

// ============================================================================
// Types
// ============================================================================

/**
 * Workspace-level OpenRouter settings stored in DB.
 */
export interface WorkspaceOpenRouterSettings {
  /** Global system prompt prepended to all AI calls */
  systemPrompt?: string;

  /** Provider routing preferences */
  routing?: {
    allow_fallbacks?: boolean;
    require_parameters?: boolean;
    sort?: 'price' | 'throughput';
    data_collection?: 'allow' | 'deny';
    zdr?: boolean;
    order?: string[];
    ignore?: string[];
    max_price?: {
      prompt?: number;
      completion?: number;
    };
  };

  /** Plugin configuration */
  plugins?: {
    responseHealing?: boolean;
    web?: boolean;
    fileParser?: boolean;
    moderation?: boolean;
    autoRouter?: boolean;
  };

  /** Model policy settings */
  modelPolicy?: {
    dynamicLatest2026?: boolean;
    preferredProviders?: string[];
  };
}

/**
 * Runtime AI context passed through AsyncLocalStorage.
 */
export interface AIContext {
  workspaceId: string;
  settings?: WorkspaceOpenRouterSettings;
  modelPreferences?: ModelPreferences;  // NEW: workspace model tier overrides
  session?: {
    mode: 'none' | 'openai_responses';
    runId: string;
    snapshotId: string;
  };
}

// ============================================================================
// AsyncLocalStorage Implementation
// ============================================================================

const aiContextStorage = new AsyncLocalStorage<AIContext>();

/**
 * Run a function within an AI context.
 * All AI calls within the function will have access to workspace settings.
 *
 * @param context - The AI context containing workspace ID and settings
 * @param fn - The function to run within the context
 */
export async function withAIContext<T>(
  context: AIContext,
  fn: () => Promise<T>
): Promise<T> {
  return aiContextStorage.run(context, fn);
}

/**
 * Run a function within an AI context (sync version).
 */
export function withAIContextSync<T>(context: AIContext, fn: () => T): T {
  return aiContextStorage.run(context, fn);
}

/**
 * Get the current AI context.
 * Returns undefined if not running within a withAIContext call.
 */
export function getAIContext(): AIContext | undefined {
  return aiContextStorage.getStore();
}

/**
 * Check if we're running within an AI context.
 */
export function hasAIContext(): boolean {
  return aiContextStorage.getStore() !== undefined;
}

// ============================================================================
// Global System Prompt Resolution
// ============================================================================

/**
 * Get the effective global system prompt.
 * Precedence: workspace DB setting > OPENROUTER_SYSTEM_PROMPT env > none
 */
export function getGlobalSystemPrompt(): string | undefined {
  const context = getAIContext();

  // Workspace setting takes precedence
  if (context?.settings?.systemPrompt) {
    return context.settings.systemPrompt;
  }

  // Fall back to env var
  return process.env.OPENROUTER_SYSTEM_PROMPT;
}

/**
 * Merge global system prompt with call-specific system prompt.
 * Global prompt is prepended to the call-specific prompt.
 *
 * @param callSystemPrompt - The system prompt from the specific AI call
 * @returns The merged system prompt
 */
export function mergeSystemPrompt(callSystemPrompt?: string): string | undefined {
  const globalPrompt = getGlobalSystemPrompt();

  if (!globalPrompt && !callSystemPrompt) {
    return undefined;
  }

  if (!globalPrompt) {
    return callSystemPrompt;
  }

  if (!callSystemPrompt) {
    return globalPrompt;
  }

  // Prepend global prompt to call-specific prompt
  return `${globalPrompt}\n\n---\n\n${callSystemPrompt}`;
}

/**
 * Build a stable prompt body from named context sections.
 * Keeps prompt assembly readable and prevents accidental empty sections.
 */
export function joinPromptSections(
  sections: Array<{ label: string; content?: string | null }>
): string {
  return sections
    .filter((section) => Boolean(section.content?.trim()))
    .map((section) => `${section.label}:\n${section.content?.trim()}`)
    .join('\n\n')
}

// ============================================================================
// Plugin Resolution
// ============================================================================

/**
 * Get effective plugin configuration.
 * Merges defaults with workspace settings.
 */
export function getPluginConfig(callType: 'structured' | 'streaming' | 'text'): Array<{ id: string }> {
  const context = getAIContext();
  const plugins: Array<{ id: string }> = [];

  // response-healing is enabled by default for structured calls
  // (non-streaming generateObject)
  if (callType === 'structured') {
    // Check workspace setting override
    const responseHealing = context?.settings?.plugins?.responseHealing;
    if (responseHealing !== false) {
      plugins.push({ id: 'response-healing' });
    }
  }

  // Add optional plugins if enabled in workspace settings
  if (context?.settings?.plugins) {
    const { web, fileParser, moderation, autoRouter } = context.settings.plugins;

    if (web) plugins.push({ id: 'web' });
    if (fileParser) plugins.push({ id: 'file-parser' });
    if (moderation) plugins.push({ id: 'moderation' });
    if (autoRouter) plugins.push({ id: 'auto-router' });
  }

  return plugins;
}

// ============================================================================
// Routing Configuration
// ============================================================================

/**
 * Get effective provider routing configuration.
 * Merges defaults with workspace settings.
 */
export function getRoutingConfig(): {
  allow_fallbacks: boolean;
  require_parameters: boolean;
  data_collection: 'allow' | 'deny';
  sort?: 'price' | 'throughput';
  order?: string[];
  max_price?: { prompt?: number; completion?: number };
} {
  const context = getAIContext();

  // Defaults
  const defaults = {
    allow_fallbacks: true,
    require_parameters: true,
    data_collection: 'deny' as const,
  };

  if (!context?.settings?.routing) {
    return defaults;
  }

  return {
    ...defaults,
    ...context.settings.routing,
  };
}
