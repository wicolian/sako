/**
 * Agent Run API Route
 * 
 * POST - Start a new agent run
 * 
 * This is the main entry point for running the AI SDK 6 campaign agent.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createServiceClient } from '@/lib/supabase/service';
import { runCampaignAgent } from '@/lib/agents/campaign-agent-v2';
import { runMultiAgentOrchestrator } from '@/lib/agents/multi-agent';
import { checkBalance, debitForAIUsage } from '@/lib/billing/ai-wallet';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: NextRequest) {
  const runId = `run-${uuidv4()}`;
  const startTime = Date.now();
  
  try {
    // Authenticate with Clerk
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const supabase = createServiceClient();
    
    const body = await request.json();
    const { 
      workspaceId, 
      brief, 
      agentType = 'single', 
      policyMode = 'standard',
      maxSteps = 10
    } = body;
    
    if (!workspaceId || !brief) {
      return NextResponse.json(
        { error: 'workspaceId and brief required' },
        { status: 400 }
      );
    }
    
    // Check wallet balance
    const balanceCheck = await checkBalance(workspaceId, 50); // Estimate 50 cents
    if (!balanceCheck.sufficient) {
      return NextResponse.json(
        { error: balanceCheck.message },
        { status: 402 } // Payment Required
      );
    }
    
    // Record agent run start
    await supabase.from('agent_runs').insert({
      id: runId,
      workspace_id: workspaceId,
      agent_name: agentType === 'multi' ? 'multi-agent-orchestrator' : 'campaign-agent-v2',
      agent_version: '2.0.0',
      status: 'running',
      input: { brief, policyMode, maxSteps },
      started_at: new Date().toISOString(),
    });
    
    // Run the appropriate agent
    let result;
    
    if (agentType === 'multi') {
      result = await runMultiAgentOrchestrator({
        task: brief,
        workspaceId,
        maxRounds: maxSteps,
      });
    } else {
      result = await runCampaignAgent({
        brief,
        workspaceId,
        policyMode,
        maxSteps,
      });
    }
    
    // Calculate costs (estimate based on steps)
    const steps = 'steps' in result ? result.steps : result.agentMessages;
    const estimatedTokens = (steps?.length || 0) * 2000 || 5000;
    const costCents = Math.ceil(estimatedTokens / 1000 * 0.5); // Rough estimate
    
    // Debit wallet
    try {
      await debitForAIUsage(
        workspaceId,
        'openai/gpt-5.4',
        estimatedTokens / 2,
        estimatedTokens / 2,
        'campaign_generation'
      );
    } catch (walletError) {
      console.error('Wallet debit failed:', walletError);
    }
    
    // Update agent run record
    const completedAt = new Date().toISOString();
    const approvalRequired = 'approvalRequired' in result ? result.approvalRequired : ('humanReviewRequired' in result ? result.humanReviewRequired : false);
    const approvalId = 'approvalId' in result ? result.approvalId : undefined;
    const campaignId = 'campaignId' in result ? result.campaignId : undefined;
    const summary = 'summary' in result ? result.summary : JSON.stringify(result.finalOutput);
    
    await supabase.from('agent_runs').update({
      status: approvalRequired ? 'waiting_approval' : 'completed',
      output: result,
      steps: steps || [],
      total_tokens: estimatedTokens,
      total_cost_cents: costCents,
      completed_at: completedAt,
    }).eq('id', runId);
    
    return NextResponse.json({
      runId,
      success: result.success,
      campaignId,
      approvalRequired,
      approvalId,
      summary,
      steps: steps?.length,
      durationMs: Date.now() - startTime,
      costCents,
    });
    
  } catch (error) {
    console.error('Agent run failed:', error);
    
    // Update run record with error
    const supabase = createServiceClient();
    await supabase.from('agent_runs').update({
      status: 'failed',
      error_message: error instanceof Error ? error.message : 'Unknown error',
      completed_at: new Date().toISOString(),
    }).eq('id', runId);
    
    return NextResponse.json(
      { 
        runId,
        error: error instanceof Error ? error.message : 'Agent run failed',
        durationMs: Date.now() - startTime,
      },
      { status: 500 }
    );
  }
}
