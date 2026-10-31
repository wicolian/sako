/**
 * AI Credit Wallet System (Jan 2026)
 * 
 * Usage-based pricing with:
 * - Pre-paid credit system
 * - Real-time balance tracking
 * - Per-model cost calculation
 * - Low balance alerts
 * - Transaction history
 * 
 * 2026 Standard: Credit-based AI pricing for SaaS
 */

import { createServiceClient } from '@/lib/supabase/service';
import { calculateCost } from '@/lib/ai/tracing';

// ============================================================================
// Types
// ============================================================================

export interface WalletTransaction {
  id: string;
  workspace_id: string;
  type: 'credit' | 'debit' | 'refund' | 'bonus';
  amount: number; // In cents (USD)
  model?: string;
  tokens?: number;
  description: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface WalletBalance {
  balance: number; // In cents
  lowBalanceThreshold: number;
  canProceed: boolean;
  lowBalanceWarning: boolean;
  estimatedRunsRemaining: number;
}

export interface UsageSummary {
  totalSpent: number;
  byModel: Record<string, number>;
  byDay: Array<{ date: string; amount: number }>;
  topOperations: Array<{ operation: string; count: number; cost: number }>;
}

// ============================================================================
// Constants
// ============================================================================

// Default low balance threshold: $5
const DEFAULT_LOW_BALANCE_THRESHOLD = 500;

// Average cost per campaign generation (rough estimate)
const AVG_CAMPAIGN_COST_CENTS = 25; // ~$0.25 per campaign

// ============================================================================
// Wallet Operations
// ============================================================================

/**
 * Get wallet balance for a workspace
 */
export async function getWalletBalance(workspaceId: string): Promise<WalletBalance> {
  const supabase = createServiceClient();
  
  // Try to get existing wallet
  let { data: wallet } = await supabase
    .from('workspace_wallets')
    .select('balance, low_balance_threshold')
    .eq('workspace_id', workspaceId)
    .single();
  
  // Create wallet if doesn't exist (new workspace gets $10 free credits)
  if (!wallet) {
    const { data: newWallet } = await supabase
      .from('workspace_wallets')
      .insert({
        workspace_id: workspaceId,
        balance: 1000, // $10 in cents - free starter credits
        low_balance_threshold: DEFAULT_LOW_BALANCE_THRESHOLD,
      })
      .select('balance, low_balance_threshold')
      .single();
    
    wallet = newWallet;
    
    // Record the initial credit transaction
    if (newWallet) {
      await recordTransaction({
        workspace_id: workspaceId,
        type: 'bonus',
        amount: 1000,
        description: 'Welcome bonus: $10 free credits',
      });
    }
  }
  
  const balance = wallet?.balance ?? 0;
  const threshold = wallet?.low_balance_threshold ?? DEFAULT_LOW_BALANCE_THRESHOLD;
  
  return {
    balance,
    lowBalanceThreshold: threshold,
    canProceed: balance > 0,
    lowBalanceWarning: balance > 0 && balance < threshold,
    estimatedRunsRemaining: Math.floor(balance / AVG_CAMPAIGN_COST_CENTS),
  };
}

/**
 * Check if workspace has sufficient balance for an operation
 */
export async function checkBalance(
  workspaceId: string,
  estimatedCost?: number
): Promise<{ sufficient: boolean; balance: number; message?: string }> {
  const wallet = await getWalletBalance(workspaceId);
  const cost = estimatedCost || AVG_CAMPAIGN_COST_CENTS;
  
  if (!wallet.canProceed) {
    return {
      sufficient: false,
      balance: wallet.balance,
      message: 'Insufficient balance. Please add credits to continue.',
    };
  }
  
  if (wallet.balance < cost) {
    return {
      sufficient: false,
      balance: wallet.balance,
      message: `Insufficient balance for this operation. Need ${formatCents(cost)}, have ${formatCents(wallet.balance)}.`,
    };
  }
  
  return {
    sufficient: true,
    balance: wallet.balance,
    message: wallet.lowBalanceWarning 
      ? `Low balance warning: ${formatCents(wallet.balance)} remaining.`
      : undefined,
  };
}

/**
 * Debit wallet for AI usage
 */
export async function debitForAIUsage(
  workspaceId: string,
  model: string,
  inputTokens: number,
  outputTokens: number,
  operation?: string
): Promise<{ success: boolean; newBalance: number; cost: number }> {
  const cost = calculateCost(model, inputTokens, outputTokens);
  const amountCents = Math.max(1, Math.ceil(cost.totalCost * 100)); // Minimum 1 cent
  
  const supabase = createServiceClient();
  
  // Atomic debit with balance check using RPC
  const { data, error } = await supabase.rpc('debit_wallet', {
    p_workspace_id: workspaceId,
    p_amount: amountCents,
  });
  
  if (error) {
    // If RPC doesn't exist, fall back to manual update
    if (error.code === '42883') {
      return await debitWalletManual(workspaceId, amountCents, model, inputTokens + outputTokens, operation);
    }
    throw new Error(`Wallet debit failed: ${error.message}`);
  }
  
  if (!data?.success) {
    throw new Error('Insufficient wallet balance');
  }
  
  // Record the transaction
  await recordTransaction({
    workspace_id: workspaceId,
    type: 'debit',
    amount: amountCents,
    model,
    tokens: inputTokens + outputTokens,
    description: operation || `AI usage: ${model}`,
    metadata: { inputTokens, outputTokens, cost: cost.totalCost },
  });
  
  return {
    success: true,
    newBalance: data.new_balance,
    cost: amountCents,
  };
}

/**
 * Manual debit fallback (if RPC not available)
 */
async function debitWalletManual(
  workspaceId: string,
  amountCents: number,
  model: string,
  tokens: number,
  operation?: string
): Promise<{ success: boolean; newBalance: number; cost: number }> {
  const supabase = createServiceClient();
  
  // Get current balance
  const { data: wallet } = await supabase
    .from('workspace_wallets')
    .select('balance')
    .eq('workspace_id', workspaceId)
    .single();
  
  if (!wallet || wallet.balance < amountCents) {
    throw new Error('Insufficient wallet balance');
  }
  
  const newBalance = wallet.balance - amountCents;
  
  // Update balance
  const { error: updateError } = await supabase
    .from('workspace_wallets')
    .update({ balance: newBalance, updated_at: new Date().toISOString() })
    .eq('workspace_id', workspaceId);
  
  if (updateError) {
    throw new Error(`Failed to update balance: ${updateError.message}`);
  }
  
  // Record transaction
  await recordTransaction({
    workspace_id: workspaceId,
    type: 'debit',
    amount: amountCents,
    model,
    tokens,
    description: operation || `AI usage: ${model}`,
  });
  
  return {
    success: true,
    newBalance,
    cost: amountCents,
  };
}

/**
 * Add credits to wallet
 */
export async function addCredits(
  workspaceId: string,
  amountCents: number,
  source: 'stripe' | 'manual' | 'bonus' | 'refund',
  metadata?: Record<string, unknown>
): Promise<{ success: boolean; newBalance: number }> {
  const supabase = createServiceClient();
  
  // Get current balance
  const { data: wallet } = await supabase
    .from('workspace_wallets')
    .select('balance')
    .eq('workspace_id', workspaceId)
    .single();
  
  const currentBalance = wallet?.balance ?? 0;
  const newBalance = currentBalance + amountCents;
  
  // Upsert wallet
  const { error: upsertError } = await supabase
    .from('workspace_wallets')
    .upsert({
      workspace_id: workspaceId,
      balance: newBalance,
      updated_at: new Date().toISOString(),
    });
  
  if (upsertError) {
    throw new Error(`Failed to add credits: ${upsertError.message}`);
  }
  
  // Record transaction
  await recordTransaction({
    workspace_id: workspaceId,
    type: source === 'refund' ? 'refund' : source === 'bonus' ? 'bonus' : 'credit',
    amount: amountCents,
    description: `Credits added via ${source}: ${formatCents(amountCents)}`,
    metadata,
  });
  
  return {
    success: true,
    newBalance,
  };
}

/**
 * Record a wallet transaction
 */
async function recordTransaction(tx: Omit<WalletTransaction, 'id' | 'created_at'>): Promise<void> {
  const supabase = createServiceClient();
  
  await supabase.from('wallet_transactions').insert({
    ...tx,
    created_at: new Date().toISOString(),
  });
}

/**
 * Get transaction history
 */
export async function getTransactionHistory(
  workspaceId: string,
  options?: { limit?: number; offset?: number; type?: WalletTransaction['type'] }
): Promise<WalletTransaction[]> {
  const supabase = createServiceClient();
  
  let query = supabase
    .from('wallet_transactions')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false });
  
  if (options?.type) {
    query = query.eq('type', options.type);
  }
  
  if (options?.limit) {
    query = query.limit(options.limit);
  }
  
  if (options?.offset) {
    query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
  }
  
  const { data } = await query;
  return data || [];
}

/**
 * Get usage summary for a period
 */
export async function getUsageSummary(
  workspaceId: string,
  startDate: Date,
  endDate: Date
): Promise<UsageSummary> {
  const supabase = createServiceClient();
  
  const { data: transactions } = await supabase
    .from('wallet_transactions')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('type', 'debit')
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString());
  
  if (!transactions?.length) {
    return {
      totalSpent: 0,
      byModel: {},
      byDay: [],
      topOperations: [],
    };
  }
  
  let totalSpent = 0;
  const byModel: Record<string, number> = {};
  const byDayMap: Record<string, number> = {};
  const operationCounts: Record<string, { count: number; cost: number }> = {};
  
  for (const tx of transactions) {
    totalSpent += tx.amount;
    
    if (tx.model) {
      byModel[tx.model] = (byModel[tx.model] || 0) + tx.amount;
    }
    
    const day = tx.created_at.split('T')[0];
    byDayMap[day] = (byDayMap[day] || 0) + tx.amount;
    
    const operation = tx.description.split(':')[0].trim();
    if (!operationCounts[operation]) {
      operationCounts[operation] = { count: 0, cost: 0 };
    }
    operationCounts[operation].count++;
    operationCounts[operation].cost += tx.amount;
  }
  
  return {
    totalSpent,
    byModel,
    byDay: Object.entries(byDayMap)
      .map(([date, amount]) => ({ date, amount }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    topOperations: Object.entries(operationCounts)
      .map(([operation, data]) => ({ operation, ...data }))
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 5),
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Format cents to dollar string
 */
export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/**
 * Estimate cost for an operation
 */
export function estimateOperationCost(
  operation: 'campaign' | 'landing_page' | 'email_sequence' | 'claim_validation' | 'video_script'
): number {
  const estimates: Record<string, number> = {
    campaign: 50, // ~$0.50
    landing_page: 30,
    email_sequence: 40,
    claim_validation: 5,
    video_script: 60,
  };
  return estimates[operation] || 25;
}

// ============================================================================
// Middleware for API Routes
// ============================================================================

/**
 * Check wallet balance before AI operation
 * Use in API routes: await requireBalance(workspaceId, 'campaign');
 */
export async function requireBalance(
  workspaceId: string,
  operation?: string
): Promise<void> {
  const estimatedCost = operation ? estimateOperationCost(operation as any) : undefined;
  const check = await checkBalance(workspaceId, estimatedCost);
  
  if (!check.sufficient) {
    throw new Error(check.message || 'Insufficient balance');
  }
}
