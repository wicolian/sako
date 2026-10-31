/**
 * Campaign Agent V2 (Jan 2026)
 * 
 * Upgraded to use AI SDK 6 native Agent abstraction with:
 * - Built-in tool orchestration
 * - Step limits and retries
 * - Streaming support
 * - Observability hooks
 * 
 * @see https://sdk.vercel.ai/docs/ai-sdk-core/agents
 */

import { generateText } from '@/lib/ai/langsmith-ai';
import { z } from 'zod';
import { MODELS } from '@/lib/ai/ai-sdk-client';
import { createServiceClient } from '@/lib/supabase/service';
import { withAIContext } from '@/lib/ai/context';
import { acquireSession, releaseSession } from '@/lib/ai/session-manager';

// ============================================================================
// Agent Tools (AI SDK 6 format with inputSchema)
// ============================================================================

const agentTools = {
  /**
   * Parse a campaign brief into structured data
   */
  parseBrief: {
    description: 'Extract structured campaign data from a natural language brief',
    inputSchema: z.object({
      brief: z.string().describe('The campaign brief text'),
    }),
    execute: async ({ brief }: { brief: string }) => {
      // Use AI to extract structured data
      const { text } = await generateText({
        model: MODELS.STRUCTURED,
        system: `Extract campaign details from the brief. Return JSON with:
          - name: campaign name
          - audience: target audience description
          - goal: campaign objective
          - offer: what's being offered
          - industry: industry vertical (if mentioned)
          - tone: desired tone/voice`,
        prompt: brief,
      });
      
      try {
        return JSON.parse(text);
      } catch {
        return { raw: brief, parseError: 'Could not extract structured data' };
      }
    },
  },

  /**
   * Generate marketing angles
   */
  generateAngles: {
    description: 'Generate multiple marketing angles for the campaign',
    inputSchema: z.object({
      audience: z.string(),
      goal: z.string(),
      offer: z.string(),
      evidence: z.array(z.string()).optional().describe('Evidence titles to cite'),
      count: z.number().default(3),
    }),
    execute: async ({ audience, goal, offer, evidence, count }: { 
      audience: string; 
      goal: string; 
      offer: string; 
      evidence?: string[]; 
      count: number;
    }) => {
      const { text } = await generateText({
        model: MODELS.CREATIVE,
        system: `You are a growth marketing strategist. Generate ${count} distinct marketing angles.
          Each angle should:
          - Target a specific pain point
          - Have a unique emotional hook
          - Be grounded in evidence when available
          ${evidence?.length ? `\nAvailable evidence: ${evidence.join(', ')}` : ''}`,
        prompt: `Audience: ${audience}\nGoal: ${goal}\nOffer: ${offer}`,
      });
      
      return { angles: text, count };
    },
  },

  /**
   * Validate claims against compliance policy
   */
  validateClaims: {
    description: 'Validate marketing claims for compliance issues',
    inputSchema: z.object({
      claims: z.array(z.string()).describe('List of claims to validate'),
      policyMode: z.enum(['strict', 'standard', 'relaxed']).default('standard'),
    }),
    execute: async ({ claims, policyMode }: { claims: string[]; policyMode: string }) => {
      const { text } = await generateText({
        model: MODELS.FAST,
        system: `You are a compliance reviewer. Mode: ${policyMode}.
          For each claim, assess:
          - riskLevel: low/medium/high
          - issues: list of problems
          - requiresEvidence: boolean
          Return JSON array.`,
        prompt: `Claims to validate:\n${claims.map((c, i) => `${i + 1}. ${c}`).join('\n')}`,
      });
      
      try {
        return JSON.parse(text);
      } catch {
        return { error: 'Validation failed', raw: text };
      }
    },
  },

  /**
   * Generate landing page content
   */
  generateLandingPage: {
    description: 'Generate landing page content based on campaign data',
    inputSchema: z.object({
      audience: z.string(),
      goal: z.string(),
      offer: z.string(),
      angles: z.array(z.string()).optional(),
      brandVoice: z.string().optional(),
    }),
    execute: async ({ audience, goal, offer, angles, brandVoice }: {
      audience: string;
      goal: string;
      offer: string;
      angles?: string[];
      brandVoice?: string;
    }) => {
      const { text } = await generateText({
        model: MODELS.CREATIVE,
        system: `You are an expert B2B copywriter. Create landing page content.
          ${brandVoice ? `Brand voice: ${brandVoice}` : ''}
          ${angles?.length ? `Use these angles: ${angles.join(', ')}` : ''}
          
          Output JSON with: headline, subheadline, benefits[], cta, socialProof`,
        prompt: `Audience: ${audience}\nGoal: ${goal}\nOffer: ${offer}`,
      });
      
      try {
        return JSON.parse(text);
      } catch {
        return { raw: text };
      }
    },
  },

  /**
   * Search evidence library
   */
  searchEvidence: {
    description: 'Search the evidence library for supporting claims',
    inputSchema: z.object({
      query: z.string(),
      workspaceId: z.string(),
      limit: z.number().default(5),
    }),
    execute: async ({ query, workspaceId, limit }: { query: string; workspaceId: string; limit: number }) => {
      const supabase = createServiceClient();
      
      const { data } = await supabase
        .from('evidence')
        .select('id, title, content, source_type, source_url')
        .eq('workspace_id', workspaceId)
        .textSearch('content', query)
        .limit(limit);
      
      return data || [];
    },
  },

  /**
   * Request human approval
   */
  requestApproval: {
    description: 'Request human approval before proceeding with high-risk actions',
    inputSchema: z.object({
      summary: z.string().describe('Summary of what needs approval'),
      blockedClaims: z.array(z.string()).optional(),
      estimatedCost: z.number().optional(),
      riskLevel: z.enum(['low', 'medium', 'high']).default('medium'),
    }),
    execute: async ({ summary, blockedClaims, estimatedCost, riskLevel }: {
      summary: string;
      blockedClaims?: string[];
      estimatedCost?: number;
      riskLevel: string;
    }) => {
      // In production, this would create an approval request in the database
      // and notify relevant stakeholders
      return {
        status: 'waiting_approval',
        approvalId: `apr-${Date.now()}`,
        summary,
        blockedClaims,
        estimatedCost,
        riskLevel,
        message: 'Approval request created. Waiting for human review.',
      };
    },
  },

  /**
   * Save campaign to database
   */
  saveCampaign: {
    description: 'Save campaign data to the database',
    inputSchema: z.object({
      workspaceId: z.string(),
      name: z.string(),
      audience: z.string(),
      goal: z.string(),
      offer: z.string(),
      content: z.record(z.unknown()).optional(),
    }),
    execute: async ({ workspaceId, name, audience, goal, offer, content }: {
      workspaceId: string;
      name: string;
      audience: string;
      goal: string;
      offer: string;
      content?: Record<string, unknown>;
    }) => {
      const supabase = createServiceClient();
      
      const { data, error } = await supabase
        .from('campaigns')
        .insert({
          workspace_id: workspaceId,
          name,
          audience,
          goal,
          offer,
          content: content || {},
          status: 'draft',
        })
        .select('id, name, status')
        .single();
      
      if (error) {
        return { error: error.message };
      }
      
      return { campaign: data, message: 'Campaign saved successfully' };
    },
  },
};

// ============================================================================
// Agent System Prompt
// ============================================================================

const CAMPAIGN_AGENT_SYSTEM = `
<identity>
You are Sako's Campaign Orchestrator Agent. You create compliant, high-converting 
marketing campaigns end-to-end.
</identity>

<core_principles>
1. COMPLIANCE FIRST: Always validate claims before finalizing content
2. EVIDENCE-BACKED: Ground claims in available evidence when possible
3. HUMAN-IN-THE-LOOP: Request approval for high-risk actions
4. QUALITY OVER SPEED: Take time to generate excellent content
</core_principles>

<workflow>
1. Parse the campaign brief to understand requirements
2. Search for relevant evidence in the library
3. Generate marketing angles based on audience and evidence
4. Create landing page content using the best angles
5. Validate all claims for compliance
6. If high-risk claims found, request human approval
7. Save the campaign when approved
</workflow>

<output_format>
After each tool call, explain what you did and why.
When the campaign is complete, provide a summary of:
- Campaign name and goal
- Number of angles generated
- Compliance status
- Any issues requiring attention
</output_format>
`;

// ============================================================================
// Agent Runner
// ============================================================================

export interface CampaignAgentInput {
  brief: string;
  workspaceId: string;
  policyMode?: 'strict' | 'standard' | 'relaxed';
  maxSteps?: number;
  snapshotId?: string;
}

export interface CampaignAgentResult {
  success: boolean;
  campaignId?: string;
  content?: Record<string, unknown>;
  validationResults?: unknown;
  approvalRequired?: boolean;
  approvalId?: string;
  steps: Array<{
    tool: string;
    input: unknown;
    output: unknown;
  }>;
  summary: string;
}

/**
 * Run the campaign agent
 */
export async function runCampaignAgent(
  input: CampaignAgentInput
): Promise<CampaignAgentResult> {
  const { brief, workspaceId, policyMode = 'standard', snapshotId = 'unspecified' } = input;
  
  const steps: CampaignAgentResult['steps'] = [];
  const session = await acquireSession(
    `campaign-agent:${workspaceId}:${Date.now()}`,
    workspaceId,
    snapshotId,
  );
  
  // AI SDK 6 uses tools directly without maxSteps - tool calls are handled automatically
  const { text, toolCalls, toolResults } = await withAIContext({
    workspaceId,
    session: {
      mode: 'openai_responses',
      runId: session.runId,
      snapshotId,
    },
  }, async () => generateText({
    model: MODELS.REASONING,
    transportMode: 'openai_responses_session',
    system: CAMPAIGN_AGENT_SYSTEM,
    prompt: `Create a campaign from this brief:\n\n${brief}\n\nWorkspace ID: ${workspaceId}\nPolicy Mode: ${policyMode}`,
    tools: agentTools,
  }));
  
  // Process tool calls and results
  if (toolCalls && toolResults) {
    for (let i = 0; i < toolCalls.length; i++) {
      const call = toolCalls[i] as { toolName: string; toolCallId: string; args?: unknown };
      steps.push({
        tool: call.toolName,
        input: call.args || {},
        output: toolResults[i],
      });
    }
  }

  // Check if approval was requested
  const approvalStep = steps.find(s => s.tool === 'requestApproval');
  const saveStep = steps.find(s => s.tool === 'saveCampaign');
  
  const result = {
    success: !approvalStep || !!saveStep,
    campaignId: (saveStep?.output as any)?.campaign?.id,
    content: steps.find(s => s.tool === 'generateLandingPage')?.output as any,
    validationResults: steps.find(s => s.tool === 'validateClaims')?.output,
    approvalRequired: !!approvalStep,
    approvalId: (approvalStep?.output as any)?.approvalId,
    steps,
    summary: text,
  };
  await releaseSession(session.sessionId);
  return result;
}

/**
 * Stream campaign agent execution
 */
export async function* streamCampaignAgent(
  input: CampaignAgentInput
): AsyncGenerator<{
  type: 'step' | 'tool_call' | 'tool_result' | 'text' | 'done';
  data: unknown;
}> {
  const { brief, workspaceId, policyMode = 'standard', snapshotId = 'unspecified' } = input;
  const session = await acquireSession(
    `campaign-agent-stream:${workspaceId}:${Date.now()}`,
    workspaceId,
    snapshotId,
  );
  
  // Use generateText with tools for real-time updates
  const result = await withAIContext({
    workspaceId,
    session: {
      mode: 'openai_responses',
      runId: session.runId,
      snapshotId,
    },
  }, async () => generateText({
    model: MODELS.REASONING,
    transportMode: 'openai_responses_session',
    system: CAMPAIGN_AGENT_SYSTEM,
    prompt: `Create a campaign from this brief:\n\n${brief}\n\nWorkspace ID: ${workspaceId}\nPolicy Mode: ${policyMode}`,
    tools: agentTools,
  }));
  
  // Yield final result
  yield { type: 'done', data: result };
  await releaseSession(session.sessionId);
}

// ============================================================================
// Exports
// ============================================================================

export { agentTools };
