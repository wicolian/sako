/**
 * External AI Tracing (Jan 2026)
 * 
 * LangSmith integration for production AI observability.
 * Tracks all AI operations with:
 * - Request/response logging
 * - Token usage and cost tracking
 * - Latency metrics
 * - Error tracking with stack traces
 * 
 * Enable by setting LANGSMITH_API_KEY in environment.
 */

import { calculateCost } from './tracing';

// ============================================================================
// Types
// ============================================================================

export interface ExternalTraceConfig {
  apiKey: string;
  project: string;
  baseUrl?: string;
}

export interface TraceRun {
  id: string;
  name: string;
  runType: 'llm' | 'chain' | 'tool' | 'embedding';
  inputs: Record<string, unknown>;
  outputs?: Record<string, unknown>;
  error?: string;
  startTime: Date;
  endTime?: Date;
  extra?: {
    model?: string;
    tokens?: {
      input?: number;
      output?: number;
      total?: number;
    };
    cost?: {
      input: number;
      output: number;
      total: number;
    };
    metadata?: Record<string, unknown>;
  };
  parentRunId?: string;
  tags?: string[];
}

// ============================================================================
// LangSmith Client
// ============================================================================

class LangSmithTracer {
  private apiKey: string;
  private project: string;
  private baseUrl: string;
  private enabled: boolean;

  constructor() {
    this.apiKey = process.env.LANGSMITH_API_KEY || '';
    this.project = process.env.LANGSMITH_PROJECT || 'sako-composer';
    this.baseUrl = process.env.LANGSMITH_BASE_URL || 'https://api.smith.langchain.com';
    this.enabled = !!this.apiKey;

    if (!this.enabled && process.env.NODE_ENV === 'development') {
      console.log('[LangSmith] Not configured - set LANGSMITH_API_KEY to enable external tracing');
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Create a new trace run in LangSmith
   */
  async createRun(run: Omit<TraceRun, 'id'>): Promise<string | null> {
    if (!this.enabled) return null;

    const runId = crypto.randomUUID();

    try {
      const response = await fetch(`${this.baseUrl}/runs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
        },
        body: JSON.stringify({
          id: runId,
          name: run.name,
          run_type: run.runType,
          inputs: run.inputs,
          start_time: run.startTime.toISOString(),
          extra: run.extra,
          tags: run.tags,
          session_name: this.project,
          parent_run_id: run.parentRunId,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[LangSmith] Failed to create run:', response.status, errorText);
        return null;
      }

      return runId;
    } catch (error) {
      console.error('[LangSmith] Error creating run:', error);
      return null;
    }
  }

  /**
   * Update a run with outputs or error
   */
  async updateRun(runId: string, update: {
    outputs?: Record<string, unknown>;
    error?: string;
    endTime: Date;
    extra?: TraceRun['extra'];
  }): Promise<void> {
    if (!this.enabled || !runId) return;

    try {
      const response = await fetch(`${this.baseUrl}/runs/${runId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
        },
        body: JSON.stringify({
          outputs: update.outputs,
          error: update.error,
          end_time: update.endTime.toISOString(),
          extra: update.extra,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[LangSmith] Failed to update run:', response.status, errorText);
      }
    } catch (error) {
      console.error('[LangSmith] Error updating run:', error);
    }
  }

  /**
   * Log feedback for a run (useful for RLHF)
   */
  async logFeedback(runId: string, feedback: {
    score: number;
    value?: string;
    comment?: string;
    key?: string;
  }): Promise<void> {
    if (!this.enabled || !runId) return;

    try {
      await fetch(`${this.baseUrl}/feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
        },
        body: JSON.stringify({
          run_id: runId,
          key: feedback.key || 'user_feedback',
          score: feedback.score,
          value: feedback.value,
          comment: feedback.comment,
        }),
      });
    } catch (error) {
      console.error('[LangSmith] Error logging feedback:', error);
    }
  }
}

// Singleton instance
const langsmith = new LangSmithTracer();

// ============================================================================
// High-Level Tracing API
// ============================================================================

/**
 * Check if external tracing is enabled
 */
export function isExternalTracingEnabled(): boolean {
  return langsmith.isEnabled();
}

/**
 * Trace an LLM call with automatic cost calculation
 */
export async function traceLLMCall<T>(
  name: string,
  model: string,
  operation: () => Promise<{ result: T; usage?: { promptTokens?: number; completionTokens?: number } }>,
  options?: {
    inputs?: Record<string, unknown>;
    tags?: string[];
    parentRunId?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<T> {
  const startTime = new Date();
  
  // Create the run
  const runId = await langsmith.createRun({
    name,
    runType: 'llm',
    inputs: options?.inputs || {},
    startTime,
    tags: options?.tags,
    parentRunId: options?.parentRunId,
    extra: {
      model,
      metadata: options?.metadata,
    },
  });

  try {
    const { result, usage } = await operation();
    
    // Calculate cost
    const cost = usage 
      ? calculateCost(model, usage.promptTokens || 0, usage.completionTokens || 0)
      : undefined;

    // Update run with success
    await langsmith.updateRun(runId!, {
      outputs: { result: typeof result === 'object' ? result : { value: result } },
      endTime: new Date(),
      extra: {
        model,
        tokens: usage ? {
          input: usage.promptTokens,
          output: usage.completionTokens,
          total: (usage.promptTokens || 0) + (usage.completionTokens || 0),
        } : undefined,
        cost: cost ? {
          input: cost.inputCost,
          output: cost.outputCost,
          total: cost.totalCost,
        } : undefined,
        metadata: options?.metadata,
      },
    });

    return result;
  } catch (error) {
    // Update run with error
    await langsmith.updateRun(runId!, {
      error: error instanceof Error ? error.message : String(error),
      endTime: new Date(),
    });
    throw error;
  }
}

/**
 * Trace a tool/function call
 */
export async function traceToolCall<T>(
  name: string,
  operation: () => Promise<T>,
  options?: {
    inputs?: Record<string, unknown>;
    tags?: string[];
    parentRunId?: string;
  }
): Promise<T> {
  const startTime = new Date();
  
  const runId = await langsmith.createRun({
    name,
    runType: 'tool',
    inputs: options?.inputs || {},
    startTime,
    tags: options?.tags,
    parentRunId: options?.parentRunId,
  });

  try {
    const result = await operation();
    
    await langsmith.updateRun(runId!, {
      outputs: { result: typeof result === 'object' ? result : { value: result } },
      endTime: new Date(),
    });

    return result;
  } catch (error) {
    await langsmith.updateRun(runId!, {
      error: error instanceof Error ? error.message : String(error),
      endTime: new Date(),
    });
    throw error;
  }
}

/**
 * Trace an embedding call
 */
export async function traceEmbedding<T>(
  name: string,
  model: string,
  operation: () => Promise<{ result: T; tokenCount?: number }>,
  options?: {
    inputs?: Record<string, unknown>;
    tags?: string[];
  }
): Promise<T> {
  const startTime = new Date();
  
  const runId = await langsmith.createRun({
    name,
    runType: 'embedding',
    inputs: options?.inputs || {},
    startTime,
    tags: options?.tags,
    extra: { model },
  });

  try {
    const { result, tokenCount } = await operation();
    
    const cost = tokenCount ? calculateCost(model, tokenCount, 0) : undefined;

    await langsmith.updateRun(runId!, {
      outputs: { dimensions: Array.isArray(result) ? result.length : 1 },
      endTime: new Date(),
      extra: {
        model,
        tokens: tokenCount ? { input: tokenCount, output: 0, total: tokenCount } : undefined,
        cost: cost ? { input: cost.inputCost, output: 0, total: cost.totalCost } : undefined,
      },
    });

    return result;
  } catch (error) {
    await langsmith.updateRun(runId!, {
      error: error instanceof Error ? error.message : String(error),
      endTime: new Date(),
    });
    throw error;
  }
}

/**
 * Log user feedback for a trace (for RLHF/quality tracking)
 */
export async function logTraceFeedback(
  runId: string,
  feedback: {
    score: number;
    value?: string;
    comment?: string;
    key?: string;
  }
): Promise<void> {
  await langsmith.logFeedback(runId, feedback);
}

// ============================================================================
// Statistics API
// ============================================================================

/**
 * Get trace statistics from local database
 * (LangSmith dashboard is the primary interface for external traces)
 */
export async function getTraceStats(
  workspaceId: string,
  days: number = 30
): Promise<{
  totalCalls: number;
  totalCost: number;
  avgLatencyMs: number;
  successRate: number;
  callsByModel: Record<string, number>;
  costByModel: Record<string, number>;
}> {
  // This function queries local ai_traces table for statistics
  // LangSmith dashboard provides more detailed analytics
  
  const { createServiceClient } = await import('@/lib/supabase/service');
  const supabase = createServiceClient();
  
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const { data: traces } = await supabase
    .from('ai_traces')
    .select('*')
    .eq('workspace_id', workspaceId)
    .gte('created_at', startDate.toISOString());

  if (!traces || traces.length === 0) {
    return {
      totalCalls: 0,
      totalCost: 0,
      avgLatencyMs: 0,
      successRate: 1,
      callsByModel: {},
      costByModel: {},
    };
  }

  let totalCost = 0;
  let totalLatency = 0;
  let successCount = 0;
  const callsByModel: Record<string, number> = {};
  const costByModel: Record<string, number> = {};

  for (const trace of traces) {
    const cost = calculateCost(
      trace.model,
      trace.prompt_tokens || 0,
      trace.completion_tokens || 0
    );
    
    totalCost += cost.totalCost;
    totalLatency += trace.latency_ms || 0;
    if (trace.success) successCount++;
    
    callsByModel[trace.model] = (callsByModel[trace.model] || 0) + 1;
    costByModel[trace.model] = (costByModel[trace.model] || 0) + cost.totalCost;
  }

  return {
    totalCalls: traces.length,
    totalCost,
    avgLatencyMs: Math.round(totalLatency / traces.length),
    successRate: successCount / traces.length,
    callsByModel,
    costByModel,
  };
}
