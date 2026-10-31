import { queryComposer, isComposerDbConfigured } from '@/lib/composerDb';
import { getISTDateBoundaries } from '@/lib/utils';

/**
 * Model pricing per 1000 tokens (in USD)
 * Based on 2026 pricing - update as needed
 */
const MODEL_COSTS: Record<string, { input: number; output: number }> = {
  // OpenAI models
  'gpt-4o': { input: 0.0025, output: 0.01 },
  'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
  'gpt-4-turbo': { input: 0.01, output: 0.03 },
  'gpt-4': { input: 0.03, output: 0.06 },
  'gpt-3.5-turbo': { input: 0.0005, output: 0.0015 },
  // Anthropic models
  'claude-3.5-sonnet': { input: 0.003, output: 0.015 },
  'claude-3-opus': { input: 0.015, output: 0.075 },
  'claude-3-sonnet': { input: 0.003, output: 0.015 },
  'claude-3-haiku': { input: 0.00025, output: 0.00125 },
  // Default fallback
  default: { input: 0.002, output: 0.008 },
};

/**
 * Calculate cost from tokens and model
 */
function calculateCost(model: string, promptTokens: number, completionTokens: number): number {
  const pricing = MODEL_COSTS[model] || MODEL_COSTS.default;
  const inputCost = (promptTokens / 1000) * pricing.input;
  const outputCost = (completionTokens / 1000) * pricing.output;
  return inputCost + outputCost;
}

interface AiTraceStatsRow {
  total_count: bigint;
  success_count: bigint;
  avg_latency: number | null;
  total_prompt_tokens: bigint | null;
  total_completion_tokens: bigint | null;
  total_tokens_sum: bigint | null;
}

interface AiTraceRow {
  count: bigint;
}

interface AiTraceCostRow {
  model: string;
  prompt_tokens: bigint | null;
  completion_tokens: bigint | null;
}

interface CampaignRow {
  count: bigint;
}

interface DeploymentRow {
  count: bigint;
}

interface WorkspaceRow {
  count: bigint;
}

/**
 * Get generation count for today (IST)
 * Table: ai_traces (lowercase, Supabase convention)
 */
export async function getGenerationCount(): Promise<number> {
  if (!isComposerDbConfigured()) return 0;

  const { start, end } = getISTDateBoundaries();

  const result = await queryComposer<AiTraceRow>(`
    SELECT COUNT(*) as count
    FROM ai_traces
    WHERE created_at >= '${start.toISOString()}'
      AND created_at <= '${end.toISOString()}'
  `);

  return result[0]?.count ? Number(result[0].count) : 0;
}

/**
 * Get detailed generation stats for today
 */
export async function getGenerationStats(): Promise<{
  count: number;
  successCount: number;
  successRate: number;
  avgLatencyMs: number;
  totalCost: number;
  avgCostPerGen: number;
  totalInputTokens: number;
  totalOutputTokens: number;
}> {
  if (!isComposerDbConfigured()) {
    return {
      count: 0,
      successCount: 0,
      successRate: 0,
      avgLatencyMs: 0,
      totalCost: 0,
      avgCostPerGen: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
    };
  }

  const { start, end } = getISTDateBoundaries();

  // Get basic stats
  const statsResult = await queryComposer<AiTraceStatsRow>(`
    SELECT 
      COUNT(*) as total_count,
      COUNT(*) FILTER (WHERE success = true) as success_count,
      AVG(latency_ms) as avg_latency,
      SUM(COALESCE(prompt_tokens, 0)) as total_prompt_tokens,
      SUM(COALESCE(completion_tokens, 0)) as total_completion_tokens,
      SUM(COALESCE(total_tokens, 0)) as total_tokens_sum
    FROM ai_traces
    WHERE created_at >= '${start.toISOString()}'
      AND created_at <= '${end.toISOString()}'
  `);

  if (!statsResult[0]) {
    return {
      count: 0,
      successCount: 0,
      successRate: 0,
      avgLatencyMs: 0,
      totalCost: 0,
      avgCostPerGen: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
    };
  }

  // Get cost breakdown by model
  const costResult = await queryComposer<AiTraceCostRow>(`
    SELECT 
      model,
      SUM(COALESCE(prompt_tokens, 0)) as prompt_tokens,
      SUM(COALESCE(completion_tokens, 0)) as completion_tokens
    FROM ai_traces
    WHERE created_at >= '${start.toISOString()}'
      AND created_at <= '${end.toISOString()}'
    GROUP BY model
  `);

  // Calculate total cost
  let totalCost = 0;
  for (const row of costResult) {
    const promptTokens = Number(row.prompt_tokens) || 0;
    const completionTokens = Number(row.completion_tokens) || 0;
    totalCost += calculateCost(row.model, promptTokens, completionTokens);
  }

  const row = statsResult[0];
  const count = Number(row.total_count);
  const successCount = Number(row.success_count);
  const totalInputTokens = Number(row.total_prompt_tokens) || 0;
  const totalOutputTokens = Number(row.total_completion_tokens) || 0;

  return {
    count,
    successCount,
    successRate: count > 0 ? (successCount / count) * 100 : 0,
    avgLatencyMs: row.avg_latency || 0,
    totalCost,
    avgCostPerGen: count > 0 ? totalCost / count : 0,
    totalInputTokens,
    totalOutputTokens,
  };
}

/**
 * Get error rate for today
 */
export async function getErrorRate(): Promise<number> {
  if (!isComposerDbConfigured()) return 0;

  const { start, end } = getISTDateBoundaries();

  const result = await queryComposer<{ total: bigint; errors: bigint }>(`
    SELECT 
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE success = false) as errors
    FROM ai_traces
    WHERE created_at >= '${start.toISOString()}'
      AND created_at <= '${end.toISOString()}'
  `);

  if (!result[0] || !result[0].total) return 0;

  const total = Number(result[0].total);
  const errors = Number(result[0].errors);

  return total > 0 ? (errors / total) * 100 : 0;
}

/**
 * Get campaigns created today
 */
export async function getCampaignsToday(): Promise<number> {
  if (!isComposerDbConfigured()) return 0;

  const { start, end } = getISTDateBoundaries();

  const result = await queryComposer<CampaignRow>(`
    SELECT COUNT(*) as count
    FROM campaigns
    WHERE created_at >= '${start.toISOString()}'
      AND created_at <= '${end.toISOString()}'
  `);

  return result[0]?.count ? Number(result[0].count) : 0;
}

/**
 * Get total campaigns count
 */
export async function getTotalCampaigns(): Promise<number> {
  if (!isComposerDbConfigured()) return 0;

  const result = await queryComposer<CampaignRow>(`
    SELECT COUNT(*) as count
    FROM campaigns
  `);

  return result[0]?.count ? Number(result[0].count) : 0;
}

/**
 * Get deployments (published campaigns) today
 */
export async function getDeploymentsToday(): Promise<number> {
  if (!isComposerDbConfigured()) return 0;

  const { start, end } = getISTDateBoundaries();

  const result = await queryComposer<DeploymentRow>(`
    SELECT COUNT(*) as count
    FROM deployments
    WHERE created_at >= '${start.toISOString()}'
      AND created_at <= '${end.toISOString()}'
      AND status = 'success'
  `);

  return result[0]?.count ? Number(result[0].count) : 0;
}

/**
 * Get active workspaces in composer (workspaces with campaigns)
 */
export async function getActiveComposerWorkspaces(): Promise<number> {
  if (!isComposerDbConfigured()) return 0;

  const result = await queryComposer<WorkspaceRow>(`
    SELECT COUNT(DISTINCT workspace_id) as count
    FROM campaigns
    WHERE created_at >= NOW() - INTERVAL '30 days'
  `);

  return result[0]?.count ? Number(result[0].count) : 0;
}

export interface ComposerDbMetrics {
  generationCount: number;
  successRate: number;
  avgLatencyMs: number;
  dailyBurn: number;
  costPerGen: number;
  totalTokens: number;
  errorRate: number;
  campaignsToday: number;
  totalCampaigns: number;
  deploymentsToday: number;
  activeWorkspaces: number;
}

/**
 * Fetch all Composer DB metrics
 */
export async function fetchComposerDbMetrics(): Promise<ComposerDbMetrics> {
  if (!isComposerDbConfigured()) {
    return {
      generationCount: 0,
      successRate: 0,
      avgLatencyMs: 0,
      dailyBurn: 0,
      costPerGen: 0,
      totalTokens: 0,
      errorRate: 0,
      campaignsToday: 0,
      totalCampaigns: 0,
      deploymentsToday: 0,
      activeWorkspaces: 0,
    };
  }

  const [stats, errorRate, campaignsToday, totalCampaigns, deploymentsToday, activeWorkspaces] =
    await Promise.all([
      getGenerationStats(),
      getErrorRate(),
      getCampaignsToday(),
      getTotalCampaigns(),
      getDeploymentsToday(),
      getActiveComposerWorkspaces(),
    ]);

  return {
    generationCount: stats.count,
    successRate: stats.successRate,
    avgLatencyMs: stats.avgLatencyMs,
    dailyBurn: stats.totalCost,
    costPerGen: stats.avgCostPerGen,
    totalTokens: stats.totalInputTokens + stats.totalOutputTokens,
    errorRate,
    campaignsToday,
    totalCampaigns,
    deploymentsToday,
    activeWorkspaces,
  };
}
