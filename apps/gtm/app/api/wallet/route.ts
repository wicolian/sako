/**
 * Wallet API Route
 * 
 * GET  - Get wallet balance and status
 * POST - Add credits to wallet
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { 
  getWalletBalance, 
  addCredits, 
  getTransactionHistory,
  getUsageSummary,
  formatCents 
} from '@/lib/billing/ai-wallet';

export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    
    // Get user
    const authHeader = request.headers.get('authorization');
    const { data: { user } } = await supabase.auth.getUser(
      authHeader?.replace('Bearer ', '')
    );
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Get workspace from query
    const workspaceId = request.nextUrl.searchParams.get('workspace_id');
    if (!workspaceId) {
      return NextResponse.json({ error: 'workspace_id required' }, { status: 400 });
    }
    
    // Get wallet balance
    const balance = await getWalletBalance(workspaceId);
    
    // Get recent transactions
    const transactions = await getTransactionHistory(workspaceId, { limit: 10 });
    
    // Get usage summary for last 30 days
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    const usage = await getUsageSummary(workspaceId, startDate, endDate);
    
    return NextResponse.json({
      balance: {
        ...balance,
        formatted: formatCents(balance.balance),
      },
      transactions,
      usage,
    });
  } catch (error) {
    console.error('Error fetching wallet:', error);
    return NextResponse.json(
      { error: 'Failed to fetch wallet data' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    
    // Get user
    const authHeader = request.headers.get('authorization');
    const { data: { user } } = await supabase.auth.getUser(
      authHeader?.replace('Bearer ', '')
    );
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const body = await request.json();
    const { workspaceId, amount, source } = body;
    
    if (!workspaceId || !amount) {
      return NextResponse.json(
        { error: 'workspaceId and amount required' },
        { status: 400 }
      );
    }
    
    // Validate source
    const validSources = ['stripe', 'manual', 'bonus', 'refund'];
    if (source && !validSources.includes(source)) {
      return NextResponse.json(
        { error: 'Invalid source' },
        { status: 400 }
      );
    }
    
    const result = await addCredits(
      workspaceId,
      Math.round(amount * 100), // Convert dollars to cents
      source || 'manual',
      { added_by: user.id }
    );
    
    return NextResponse.json({
      success: true,
      newBalance: result.newBalance,
      formatted: formatCents(result.newBalance),
    });
  } catch (error) {
    console.error('Error adding credits:', error);
    return NextResponse.json(
      { error: 'Failed to add credits' },
      { status: 500 }
    );
  }
}
