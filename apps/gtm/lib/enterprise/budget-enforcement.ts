/**
 * Budget Hard Cap Enforcement (Jan 2026)
 * 
 * Implements automatic cutoff when workspace exceeds budget:
 * - Hard cap checking before AI operations
 * - Budget alerts at configurable thresholds
 * - Usage forecasting
 * - Admin notifications
 * 
 * 2026 Standard: Cost control is mandatory for enterprise AI products
 */

import { createServiceClient } from '@/lib/supabase/service';
import { formatCents, getWalletBalance } from '@/lib/billing/ai-wallet';
import { getWorkspaceCosts } from '@/lib/ai/tracing';

// ============================================================================
// Types
// ============================================================================

export interface BudgetConfig {
  monthlyHardCapCents: number | null; // null = unlimited
  alertThresholds: number[]; // Percentages, e.g., [50, 80, 90, 100]
  notifyEmails: string[];
  autoTopUp: boolean;
  autoTopUpAmount: number; // In cents
}

export interface BudgetStatus {
  currentSpend: number;
  hardCap: number | null;
  percentUsed: number | null;
  remaining: number | null;
  isBlocked: boolean;
  alertLevel: 'normal' | 'warning' | 'critical' | 'exceeded';
  forecast: {
    endOfMonthEstimate: number;
    willExceed: boolean;
    daysUntilExceeded: number | null;
  };
}

export interface BudgetAlert {
  id: string;
  workspace_id: string;
  threshold_percent: number;
  current_spend: number;
  hard_cap: number;
  triggered_at: string;
  acknowledged_at: string | null;
  notified: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_ALERT_THRESHOLDS = [50, 80, 90, 100];

// ============================================================================
// Budget Configuration
// ============================================================================

/**
 * Get budget configuration for a workspace
 */
export async function getBudgetConfig(workspaceId: string): Promise<BudgetConfig> {
  const supabase = createServiceClient();
  
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('settings')
    .eq('id', workspaceId)
    .single();
  
  const settings = workspace?.settings as Record<string, unknown> || {};
  
  return {
    monthlyHardCapCents: (settings.budget_hard_cap_cents as number) ?? null,
    alertThresholds: (settings.budget_alert_thresholds as number[]) ?? DEFAULT_ALERT_THRESHOLDS,
    notifyEmails: (settings.budget_notify_emails as string[]) ?? [],
    autoTopUp: (settings.budget_auto_top_up as boolean) ?? false,
    autoTopUpAmount: (settings.budget_auto_top_up_amount as number) ?? 10000, // $100 default
  };
}

/**
 * Update budget configuration for a workspace
 */
export async function updateBudgetConfig(
  workspaceId: string,
  config: Partial<BudgetConfig>
): Promise<void> {
  const supabase = createServiceClient();
  
  // Get current settings
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('settings')
    .eq('id', workspaceId)
    .single();
  
  const currentSettings = (workspace?.settings as Record<string, unknown>) || {};
  
  // Merge new budget settings
  const newSettings = {
    ...currentSettings,
    ...(config.monthlyHardCapCents !== undefined && { budget_hard_cap_cents: config.monthlyHardCapCents }),
    ...(config.alertThresholds && { budget_alert_thresholds: config.alertThresholds }),
    ...(config.notifyEmails && { budget_notify_emails: config.notifyEmails }),
    ...(config.autoTopUp !== undefined && { budget_auto_top_up: config.autoTopUp }),
    ...(config.autoTopUpAmount !== undefined && { budget_auto_top_up_amount: config.autoTopUpAmount }),
  };
  
  await supabase
    .from('workspaces')
    .update({ settings: newSettings })
    .eq('id', workspaceId);
}

// ============================================================================
// Budget Status & Checking
// ============================================================================

/**
 * Get current budget status for a workspace
 */
export async function getBudgetStatus(workspaceId: string): Promise<BudgetStatus> {
  const [config, costs] = await Promise.all([
    getBudgetConfig(workspaceId),
    getCurrentMonthSpend(workspaceId),
  ]);
  
  const currentSpend = costs;
  const hardCap = config.monthlyHardCapCents;
  
  // Calculate percentages
  const percentUsed = hardCap ? (currentSpend / hardCap) * 100 : null;
  const remaining = hardCap ? Math.max(0, hardCap - currentSpend) : null;
  const isBlocked = hardCap !== null && currentSpend >= hardCap;
  
  // Determine alert level
  let alertLevel: BudgetStatus['alertLevel'] = 'normal';
  if (percentUsed !== null) {
    if (percentUsed >= 100) alertLevel = 'exceeded';
    else if (percentUsed >= 90) alertLevel = 'critical';
    else if (percentUsed >= 80) alertLevel = 'warning';
  }
  
  // Calculate forecast
  const forecast = await calculateBudgetForecast(workspaceId, currentSpend, hardCap);
  
  return {
    currentSpend,
    hardCap,
    percentUsed,
    remaining,
    isBlocked,
    alertLevel,
    forecast,
  };
}

/**
 * Get current month's spend in cents
 */
async function getCurrentMonthSpend(workspaceId: string): Promise<number> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  
  const costs = await getWorkspaceCosts(workspaceId, startOfMonth, endOfMonth);
  
  // Convert dollars to cents
  return Math.round(costs.totalCost * 100);
}

/**
 * Calculate budget forecast
 */
async function calculateBudgetForecast(
  workspaceId: string,
  currentSpend: number,
  hardCap: number | null
): Promise<BudgetStatus['forecast']> {
  const now = new Date();
  const dayOfMonth = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysRemaining = daysInMonth - dayOfMonth;
  
  // Simple linear projection
  const dailyAverage = dayOfMonth > 0 ? currentSpend / dayOfMonth : 0;
  const endOfMonthEstimate = Math.round(dailyAverage * daysInMonth);
  
  let willExceed = false;
  let daysUntilExceeded: number | null = null;
  
  if (hardCap !== null) {
    willExceed = endOfMonthEstimate > hardCap;
    
    if (dailyAverage > 0 && hardCap > currentSpend) {
      daysUntilExceeded = Math.ceil((hardCap - currentSpend) / dailyAverage);
    } else if (currentSpend >= hardCap) {
      daysUntilExceeded = 0;
    }
  }
  
  return {
    endOfMonthEstimate,
    willExceed,
    daysUntilExceeded,
  };
}

// ============================================================================
// Budget Enforcement
// ============================================================================

/**
 * Check if workspace can proceed with AI operation
 * Throws error if budget exceeded
 */
export async function checkBudgetHardCap(
  workspaceId: string,
  estimatedCostCents?: number
): Promise<void> {
  const status = await getBudgetStatus(workspaceId);
  
  if (status.isBlocked) {
    throw new BudgetExceededError(
      `Monthly budget limit of ${formatCents(status.hardCap!)} has been reached. ` +
      `Current spend: ${formatCents(status.currentSpend)}. ` +
      `Please increase your budget limit or wait until next month.`,
      {
        currentSpend: status.currentSpend,
        hardCap: status.hardCap!,
        percentUsed: status.percentUsed!,
      }
    );
  }
  
  // Check if this operation would exceed the cap
  if (estimatedCostCents && status.hardCap !== null) {
    if (status.currentSpend + estimatedCostCents > status.hardCap) {
      throw new BudgetExceededError(
        `This operation would exceed your monthly budget limit. ` +
        `Current: ${formatCents(status.currentSpend)}, ` +
        `Operation: ~${formatCents(estimatedCostCents)}, ` +
        `Limit: ${formatCents(status.hardCap)}.`,
        {
          currentSpend: status.currentSpend,
          hardCap: status.hardCap,
          estimatedCost: estimatedCostCents,
        }
      );
    }
  }
  
  // Trigger alerts if needed
  await checkAndTriggerAlerts(workspaceId, status);
}

/**
 * Custom error for budget exceeded
 */
export class BudgetExceededError extends Error {
  public readonly code = 'BUDGET_EXCEEDED';
  public readonly details: {
    currentSpend: number;
    hardCap: number;
    percentUsed?: number;
    estimatedCost?: number;
  };
  
  constructor(message: string, details: BudgetExceededError['details']) {
    super(message);
    this.name = 'BudgetExceededError';
    this.details = details;
  }
}

// ============================================================================
// Alert System
// ============================================================================

/**
 * Check and trigger budget alerts
 */
async function checkAndTriggerAlerts(
  workspaceId: string,
  status: BudgetStatus
): Promise<void> {
  if (status.percentUsed === null || status.hardCap === null) return;
  
  const config = await getBudgetConfig(workspaceId);
  const supabase = createServiceClient();
  
  // Get already triggered alerts this month
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  
  const { data: existingAlerts } = await supabase
    .from('budget_alerts')
    .select('threshold_percent')
    .eq('workspace_id', workspaceId)
    .gte('triggered_at', startOfMonth.toISOString());
  
  const triggeredThresholds = new Set(existingAlerts?.map(a => a.threshold_percent) || []);
  
  // Check which thresholds should be triggered
  for (const threshold of config.alertThresholds) {
    if (status.percentUsed >= threshold && !triggeredThresholds.has(threshold)) {
      await triggerBudgetAlert(workspaceId, threshold, status.currentSpend, status.hardCap, config);
    }
  }
}

/**
 * Trigger a budget alert
 */
async function triggerBudgetAlert(
  workspaceId: string,
  threshold: number,
  currentSpend: number,
  hardCap: number,
  config: BudgetConfig
): Promise<void> {
  const supabase = createServiceClient();
  
  // Record the alert
  await supabase.from('budget_alerts').insert({
    workspace_id: workspaceId,
    threshold_percent: threshold,
    current_spend: currentSpend,
    hard_cap: hardCap,
    notified: config.notifyEmails.length > 0,
  });
  
  // Send notification emails (in production, integrate with email service)
  if (config.notifyEmails.length > 0) {
    console.log(`[Budget Alert] Workspace ${workspaceId}: ${threshold}% threshold reached`);
    console.log(`  - Current spend: ${formatCents(currentSpend)}`);
    console.log(`  - Hard cap: ${formatCents(hardCap)}`);
    console.log(`  - Notify: ${config.notifyEmails.join(', ')}`);
    
    // TODO: Integrate with email service (SendGrid, Resend, etc.)
    // await sendBudgetAlertEmail(config.notifyEmails, {
    //   threshold,
    //   currentSpend,
    //   hardCap,
    //   workspaceId,
    // });
  }
}

/**
 * Get budget alerts for a workspace
 */
export async function getBudgetAlerts(
  workspaceId: string,
  options?: { acknowledged?: boolean; limit?: number }
): Promise<BudgetAlert[]> {
  const supabase = createServiceClient();
  
  let query = supabase
    .from('budget_alerts')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('triggered_at', { ascending: false });
  
  if (options?.acknowledged !== undefined) {
    if (options.acknowledged) {
      query = query.not('acknowledged_at', 'is', null);
    } else {
      query = query.is('acknowledged_at', null);
    }
  }
  
  if (options?.limit) {
    query = query.limit(options.limit);
  }
  
  const { data } = await query;
  return data || [];
}

/**
 * Acknowledge a budget alert
 */
export async function acknowledgeBudgetAlert(alertId: string): Promise<void> {
  const supabase = createServiceClient();
  
  await supabase
    .from('budget_alerts')
    .update({ acknowledged_at: new Date().toISOString() })
    .eq('id', alertId);
}

// ============================================================================
// Middleware for API Routes
// ============================================================================

/**
 * Enforce budget hard cap before AI operation
 * Use in API routes: await enforceBudget(workspaceId, 50); // estimated cost in cents
 */
export async function enforceBudget(
  workspaceId: string,
  estimatedCostCents?: number
): Promise<{ allowed: boolean; status: BudgetStatus; error?: string }> {
  try {
    await checkBudgetHardCap(workspaceId, estimatedCostCents);
    const status = await getBudgetStatus(workspaceId);
    return { allowed: true, status };
  } catch (error) {
    if (error instanceof BudgetExceededError) {
      return {
        allowed: false,
        status: await getBudgetStatus(workspaceId),
        error: error.message,
      };
    }
    throw error;
  }
}

// ============================================================================
// Budget Management API
// ============================================================================

/**
 * Set monthly budget hard cap (in dollars)
 */
export async function setBudgetHardCap(
  workspaceId: string,
  amountDollars: number | null
): Promise<void> {
  await updateBudgetConfig(workspaceId, {
    monthlyHardCapCents: amountDollars !== null ? Math.round(amountDollars * 100) : null,
  });
}

/**
 * Set budget alert notification emails
 */
export async function setBudgetNotifyEmails(
  workspaceId: string,
  emails: string[]
): Promise<void> {
  await updateBudgetConfig(workspaceId, {
    notifyEmails: emails,
  });
}

/**
 * Set custom alert thresholds
 */
export async function setBudgetAlertThresholds(
  workspaceId: string,
  thresholds: number[]
): Promise<void> {
  await updateBudgetConfig(workspaceId, {
    alertThresholds: thresholds.sort((a, b) => a - b),
  });
}
