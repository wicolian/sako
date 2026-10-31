/**
 * AI Tracing & Cost Tracking (Jan 2026)
 * 
 * OpenTelemeimport { Database } from '@/lib/supabase/types'

try-compatible tracing for AI operations with:
 * - Request/response logging
 * - Token usage and cost tracking
 * - Latency metrics
 * - Error tracking
 * 
 * Can be connected to LangSmith, Datadog, or any OTEL-compatible backend.
 */

import { createServiceClient } from '@/lib/supabase/service';

// ============================================================================
// Types
// ============================================================================

export interface AITrace {
  id: string;
  operationType: 'generate' | 'stream' | 'embed' | 'tool_call';
  model: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  latencyMs: number;
  success: boolean;
  error?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

export interface CostEstimate {
  model: string;
  inputTokens: number;
  outputTokens: number;
  inputCost: number;
  outputCost: number;
  totalCost: number;
}

// ============================================================================
// Model Pricing (Mar 2026 - Latest OpenRouter, per 1M tokens)
// ============================================================================

const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  // OpenAI GPT-5 family (LATEST - Mar 2026)
  'openai/gpt-5.4': { input: 2.50, output: 15.00 },           // 1.05M context
  'openai/gpt-5.4-pro': { input: 30.00, output: 180.00 },     // Pro tier
  'openai/gpt-5.3-chat': { input: 1.75, output: 14.00 },      // Fast chat
  'openai/gpt-5.3-codex': { input: 1.75, output: 14.00 },     // Code specialist
  'openai/gpt-5.2': { input: 1.75, output: 14.00 },           // Legacy fallback
  'openai/gpt-5.2-chat': { input: 1.75, output: 14.00 },      // Legacy fallback
  'openai/gpt-5.2-codex': { input: 1.75, output: 14.00 },     // Legacy fallback
  
  // Anthropic Claude 4.6 family (LATEST - Feb 2026)
  'anthropic/claude-opus-4.6': { input: 5.00, output: 25.00 },   // Feb 4
  'anthropic/claude-sonnet-4.6': { input: 3.00, output: 15.00 }, // Feb 17
  
  // Google Gemini 3.1 family (Feb 2026)
  'google/gemini-3.1-pro-preview': { input: 2.00, output: 12.00 }, // 1M context
  
  // Embeddings
  'openai/text-embedding-3-large': { input: 0.13, output: 0 },
  'openai/text-embedding-3-small': { input: 0.02, output: 0 },
};

// ============================================================================
// Tracing Functions
// ============================================================================

// Lazy initialization to avoid build-time errors
let _supabase: ReturnType<typeof createServiceClient> | null = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createServiceClient();
  }
  return _supabase;
}

/**
 * Create a trace for an AI operation
 */
export async function createTrace(trace: Omit<AITrace, 'id' | 'createdAt'>): Promise<string> {
  const id = crypto.randomUUID();
  
  const { error } = await getSupabase().from('ai_traces').insert({
    id,
    operation_type: trace.operationType,
    model: trace.model,
    prompt_tokens: trace.promptTokens,
    completion_tokens: trace.completionTokens,
    total_tokens: trace.totalTokens,
    latency_ms: trace.latencyMs,
    success: trace.success,
    error: trace.error,
    metadata: trace.metadata,
  });

  if (error) {
    console.error('Failed to create trace:', error);
  }

  return id;
}

/**
 * Calculate cost for a model invocation
 */
export function calculateCost(
  model: string,
  inputTokens: number,
  outputTokens: number
): CostEstimate {
  const pricing = MODEL_PRICING[model] || { input: 0, output: 0 };
  
  const inputCost = (inputTokens / 1_000_000) * pricing.input;
  const outputCost = (outputTokens / 1_000_000) * pricing.output;
  
  return {
    model,
    inputTokens,
    outputTokens,
    inputCost,
    outputCost,
    totalCost: inputCost + outputCost,
  };
}

/**
 * Get aggregated costs for a workspace
 */
export async function getWorkspaceCosts(
  workspaceId: string,
  startDate: Date,
  endDate: Date
): Promise<{
  totalCost: number;
  byModel: Record<string, number>;
  byDay: Array<{ date: string; cost: number }>;
}> {
  const { data: traces } = await getSupabase()
    .from('ai_traces')
    .select('model, prompt_tokens, completion_tokens, created_at')
    .eq('workspace_id', workspaceId)
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString());

  if (!traces) {
    return { totalCost: 0, byModel: {}, byDay: [] };
  }

  let totalCost = 0;
  const byModel: Record<string, number> = {};
  const byDayMap: Record<string, number> = {};

  for (const trace of traces) {
    const cost = calculateCost(
      trace.model,
      trace.prompt_tokens || 0,
      trace.completion_tokens || 0
    );
    
    totalCost += cost.totalCost;
    byModel[trace.model] = (byModel[trace.model] || 0) + cost.totalCost;
    
    const day = trace.created_at.split('T')[0];
    byDayMap[day] = (byDayMap[day] || 0) + cost.totalCost;
  }

  const byDay = Object.entries(byDayMap)
    .map(([date, cost]) => ({ date, cost }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return { totalCost, byModel, byDay };
}

// ============================================================================
// Wrapper for Traced Operations
// ============================================================================

/**
 * Wrap an AI operation with automatic tracing
 */
export async function withTracing<T>(
  operation: () => Promise<T>,
  meta: {
    operationType: AITrace['operationType'];
    model: string;
    metadata?: Record<string, unknown>;
  }
): Promise<T> {
  const startTime = Date.now();
  
  try {
    const result = await operation();
    
    await createTrace({
      operationType: meta.operationType,
      model: meta.model,
      latencyMs: Date.now() - startTime,
      success: true,
      metadata: meta.metadata,
    });
    
    return result;
  } catch (error) {
    await createTrace({
      operationType: meta.operationType,
      model: meta.model,
      latencyMs: Date.now() - startTime,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      metadata: meta.metadata,
    });
    
    throw error;
  }
}

// ============================================================================
// Console Logging (for development)
// ============================================================================

export function logAICall(
  model: string,
  operation: string,
  latencyMs: number,
  tokens?: { input?: number; output?: number }
) {
  if (process.env.NODE_ENV === 'development') {
    const cost = tokens
      ? calculateCost(model, tokens.input || 0, tokens.output || 0)
      : null;
    
    console.log(
      `[AI] ${operation} | ${model} | ${latencyMs}ms` +
      (cost ? ` | $${cost.totalCost.toFixed(4)}` : '')
    );
  }
}

// ============================================================================
// Enhanced Tracing with External Integration
// ============================================================================

/**
 * Log an AI call to both local database and external tracing (LangSmith)
 * 
 * This is the main entry point for tracing AI operations in production.
 * It automatically:
 * - Records to local ai_traces table
 * - Sends to LangSmith if LANGSMITH_API_KEY is configured
 * - Calculates and logs costs
 */
export async function logAICallWithExternalTracing(
  workspaceId: string,
  model: string,
  operation: string,
  startTime: number,
  tokens?: { input?: number; output?: number },
  options?: {
    success?: boolean;
    error?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<string> {
  const latencyMs = Date.now() - startTime;
  const cost = tokens
    ? calculateCost(model, tokens.input || 0, tokens.output || 0)
    : null;

  // Log to console in development
  logAICall(model, operation, latencyMs, tokens);

  // Record to local database
  const traceId = await createTrace({
    operationType: operation.includes('embed') ? 'embed' : 
                   operation.includes('stream') ? 'stream' : 'generate',
    model,
    promptTokens: tokens?.input,
    completionTokens: tokens?.output,
    totalTokens: tokens ? (tokens.input || 0) + (tokens.output || 0) : undefined,
    latencyMs,
    success: options?.success ?? true,
    error: options?.error,
    metadata: {
      ...options?.metadata,
      workspace_id: workspaceId,
      operation,
      cost: cost?.totalCost,
    },
  });

  // Send to external tracing (LangSmith) if configured
  if (process.env.LANGSMITH_API_KEY) {
    try {
      const { traceLLMCall } = await import('./external-tracing');
      // Fire and forget - don't block on external tracing
      traceLLMCall(
        operation,
        model,
        async () => ({
          result: { traceId },
          usage: tokens ? { promptTokens: tokens.input, completionTokens: tokens.output } : undefined,
        }),
        {
          inputs: options?.metadata || {},
          tags: [workspaceId, model, options?.success ? 'success' : 'error'],
          metadata: {
            workspace_id: workspaceId,
            latency_ms: latencyMs,
            ...options?.metadata,
          },
        }
      ).catch(err => {
        console.error('[External Tracing] Failed to send to LangSmith:', err);
      });
    } catch (err) {
      // External tracing is optional - don't fail if it's not available
      console.error('[External Tracing] Import failed:', err);
    }
  }

  return traceId;
}

// ============================================================================
// Statistics Export
// ============================================================================

/**
 * Export trace statistics for analytics dashboards
 */
export async function getTraceStatistics(
  workspaceId: string,
  startDate: Date,
  endDate: Date
): Promise<{
  summary: {
    totalCalls: number;
    totalCost: number;
    avgLatencyMs: number;
    successRate: number;
  };
  byModel: Array<{
    model: string;
    calls: number;
    cost: number;
    avgLatency: number;
    errorRate: number;
  }>;
  byDay: Array<{
    date: string;
    calls: number;
    cost: number;
  }>;
  recentErrors: Array<{
    timestamp: string;
    model: string;
    operation: string;
    error: string;
  }>;
}> {
  const { data: traces } = await getSupabase()
    .from('ai_traces')
    .select('*')
    .eq('workspace_id', workspaceId)
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString())
    .order('created_at', { ascending: false });

  if (!traces || traces.length === 0) {
    return {
      summary: { totalCalls: 0, totalCost: 0, avgLatencyMs: 0, successRate: 1 },
      byModel: [],
      byDay: [],
      recentErrors: [],
    };
  }

  // Calculate summary
  let totalCost = 0;
  let totalLatency = 0;
  let successCount = 0;
  const modelStats: Record<string, { calls: number; cost: number; latency: number; errors: number }> = {};
  const dayStats: Record<string, { calls: number; cost: number }> = {};
  const recentErrors: Array<{ timestamp: string; model: string; operation: string; error: string }> = [];

  for (const trace of traces) {
    const cost = calculateCost(trace.model, trace.prompt_tokens || 0, trace.completion_tokens || 0);
    totalCost += cost.totalCost;
    totalLatency += trace.latency_ms || 0;
    if (trace.success) successCount++;

    // Model stats
    if (!modelStats[trace.model]) {
      modelStats[trace.model] = { calls: 0, cost: 0, latency: 0, errors: 0 };
    }
    modelStats[trace.model].calls++;
    modelStats[trace.model].cost += cost.totalCost;
    modelStats[trace.model].latency += trace.latency_ms || 0;
    if (!trace.success) modelStats[trace.model].errors++;

    // Day stats
    const day = trace.created_at.split('T')[0];
    if (!dayStats[day]) {
      dayStats[day] = { calls: 0, cost: 0 };
    }
    dayStats[day].calls++;
    dayStats[day].cost += cost.totalCost;

    // Recent errors (max 10)
    if (!trace.success && trace.error && recentErrors.length < 10) {
      recentErrors.push({
        timestamp: trace.created_at,
        model: trace.model,
        operation: trace.operation_type,
        error: trace.error,
      });
    }
  }

  return {
    summary: {
      totalCalls: traces.length,
      totalCost,
      avgLatencyMs: Math.round(totalLatency / traces.length),
      successRate: successCount / traces.length,
    },
    byModel: Object.entries(modelStats).map(([model, stats]) => ({
      model,
      calls: stats.calls,
      cost: stats.cost,
      avgLatency: Math.round(stats.latency / stats.calls),
      errorRate: stats.errors / stats.calls,
    })),
    byDay: Object.entries(dayStats)
      .map(([date, stats]) => ({ date, ...stats }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    recentErrors,
  };
}
