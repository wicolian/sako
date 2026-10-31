/**
 * Multi-Agent Orchestration (A2A) (Jan 2026)
 * 
 * Agent-to-agent collaboration for complex workflows:
 * - Specialist agents for different tasks
 * - Supervisor pattern for orchestration
 * - Message passing between agents
 * - Shared context management
 * 
 * @see https://sdk.vercel.ai/docs/ai-sdk-core/agents#multi-agent
 */

import { generateText } from '@/lib/ai/langsmith-ai';
import { z } from 'zod';
import { MODELS } from '@/lib/ai/ai-sdk-client';

// ============================================================================
// Specialist Agent Definitions
// ============================================================================

export interface AgentMessage {
  from: string;
  to: string;
  content: string;
  metadata?: Record<string, unknown>;
  timestamp: Date;
}

export interface AgentContext {
  messages: AgentMessage[];
  sharedData: Record<string, unknown>;
  currentTask?: string;
}

// ============================================================================
// Research Specialist Agent
// ============================================================================

const researchAgentTools = {
  searchEvidence: {
    description: 'Search for evidence to support marketing claims',
    inputSchema: z.object({
      query: z.string(),
      sources: z.array(z.enum(['internal', 'web', 'competitors'])).default(['internal']),
    }),
    execute: async ({ query, sources }: { query: string; sources: string[] }) => {
      // In production, this would search the evidence library and web
      return {
        found: true,
        evidence: [
          { source: 'internal', title: 'Customer Case Study', relevance: 0.9 },
        ],
        query,
        sources,
      };
    },
  },
  
  analyzeCompetitor: {
    description: 'Analyze competitor positioning',
    inputSchema: z.object({
      competitor: z.string(),
      aspects: z.array(z.string()).default(['messaging', 'pricing', 'features']),
    }),
    execute: async ({ competitor, aspects }: { competitor: string; aspects: string[] }) => {
      return {
        competitor,
        aspects,
        analysis: `Analysis of ${competitor} across ${aspects.join(', ')}`,
      };
    },
  },
};

async function runResearchAgent(task: string, context: AgentContext): Promise<{
  result: unknown;
  messages: AgentMessage[];
}> {
  const { text, toolResults } = await generateText({
    model: MODELS.BALANCED,
    system: `You are Sako's Research Specialist Agent. Your job is to find and analyze 
evidence to support marketing claims. You have access to internal evidence libraries 
and public data sources.

Previous context:
${context.messages.map(m => `${m.from}: ${m.content}`).join('\n')}`,
    prompt: task,
    tools: researchAgentTools,
  });
  
  return {
    result: { summary: text, toolResults },
    messages: [{
      from: 'research-agent',
      to: 'supervisor',
      content: text,
      timestamp: new Date(),
    }],
  };
}

// ============================================================================
// Compliance Reviewer Agent
// ============================================================================

const complianceAgentTools = {
  validateClaim: {
    description: 'Validate a marketing claim for compliance',
    inputSchema: z.object({
      claim: z.string(),
      policyMode: z.enum(['strict', 'standard', 'relaxed']).default('standard'),
    }),
    execute: async ({ claim, policyMode }: { claim: string; policyMode: string }) => {
      // Simplified validation logic
      const hasSuperlative = /best|#1|only|fastest|leading/i.test(claim);
      const hasGuarantee = /guaranteed|always|100%/i.test(claim);
      
      return {
        claim,
        policyMode,
        riskLevel: hasSuperlative || hasGuarantee ? 'high' : 'low',
        issues: [
          ...(hasSuperlative ? ['Contains superlative without evidence'] : []),
          ...(hasGuarantee ? ['Contains absolute guarantee'] : []),
        ],
      };
    },
  },
  
  suggestRewrite: {
    description: 'Suggest a compliant rewrite for a risky claim',
    inputSchema: z.object({
      claim: z.string(),
      issues: z.array(z.string()),
    }),
    execute: async ({ claim, issues }: { claim: string; issues: string[] }) => {
      const { text } = await generateText({
        model: MODELS.CREATIVE,
        prompt: `Rewrite this marketing claim to be compliant while keeping it persuasive:
Claim: "${claim}"
Issues: ${issues.join(', ')}

Return only the rewritten claim.`,
      });
      return { original: claim, rewritten: text.trim() };
    },
  },
};

async function runComplianceAgent(task: string, context: AgentContext): Promise<{
  result: unknown;
  messages: AgentMessage[];
}> {
  const { text, toolResults } = await generateText({
    model: MODELS.REASONING,
    system: `You are Sako's Compliance Reviewer Agent. Your job is to validate marketing 
content for regulatory compliance (FTC, industry-specific rules) and suggest compliant 
alternatives when issues are found.

Previous context:
${context.messages.map(m => `${m.from}: ${m.content}`).join('\n')}`,
    prompt: task,
    tools: complianceAgentTools,
  });
  
  return {
    result: { summary: text, toolResults },
    messages: [{
      from: 'compliance-agent',
      to: 'supervisor',
      content: text,
      timestamp: new Date(),
    }],
  };
}

// ============================================================================
// Creative Writer Agent
// ============================================================================

const creativeAgentTools = {
  generateHeadlines: {
    description: 'Generate multiple headline options',
    inputSchema: z.object({
      audience: z.string(),
      valueProposition: z.string(),
      tone: z.string().default('professional'),
      count: z.number().default(5),
    }),
    execute: async ({ audience, valueProposition, tone, count }: {
      audience: string;
      valueProposition: string;
      tone: string;
      count: number;
    }) => {
      const { text } = await generateText({
        model: MODELS.CREATIVE,
        prompt: `Generate ${count} headline options for ${audience}.
Value proposition: ${valueProposition}
Tone: ${tone}

Return as JSON array of strings.`,
      });
      try {
        return { headlines: JSON.parse(text) };
      } catch {
        return { headlines: [text] };
      }
    },
  },
  
  writeBody: {
    description: 'Write body copy for marketing content',
    inputSchema: z.object({
      headline: z.string(),
      audience: z.string(),
      benefits: z.array(z.string()),
      maxWords: z.number().default(200),
    }),
    execute: async ({ headline, audience, benefits, maxWords }: {
      headline: string;
      audience: string;
      benefits: string[];
      maxWords: number;
    }) => {
      const { text } = await generateText({
        model: MODELS.CREATIVE,
        prompt: `Write body copy (max ${maxWords} words) for a landing page.
Headline: ${headline}
Audience: ${audience}
Key benefits to include: ${benefits.join(', ')}`,
      });
      return { body: text };
    },
  },
  
  createCTAs: {
    description: 'Generate call-to-action options',
    inputSchema: z.object({
      action: z.string(),
      urgency: z.enum(['low', 'medium', 'high']).default('medium'),
      count: z.number().default(3),
    }),
    execute: async ({ action, urgency, count }: { action: string; urgency: string; count: number }) => {
      const { text } = await generateText({
        model: MODELS.CREATIVE,
        prompt: `Generate ${count} CTA button texts for action: ${action}
Urgency level: ${urgency}
Return as JSON array.`,
      });
      try {
        return { ctas: JSON.parse(text) };
      } catch {
        return { ctas: [text] };
      }
    },
  },
};

async function runCreativeAgent(task: string, context: AgentContext): Promise<{
  result: unknown;
  messages: AgentMessage[];
}> {
  const { text, toolResults } = await generateText({
    model: MODELS.CREATIVE,
    system: `You are Sako's Creative Writer Agent. You write compelling, high-converting 
marketing copy that is specific, benefit-focused, and avoids generic "AI slop."

Previous context:
${context.messages.map(m => `${m.from}: ${m.content}`).join('\n')}`,
    prompt: task,
    tools: creativeAgentTools,
  });
  
  return {
    result: { summary: text, toolResults },
    messages: [{
      from: 'creative-agent',
      to: 'supervisor',
      content: text,
      timestamp: new Date(),
    }],
  };
}

// ============================================================================
// Supervisor Agent (Orchestrator)
// ============================================================================

type AgentName = 'research' | 'compliance' | 'creative';

const supervisorTools = {
  delegateToAgent: {
    description: 'Delegate a task to a specialist agent',
    inputSchema: z.object({
      agent: z.enum(['research', 'compliance', 'creative']),
      task: z.string(),
    }),
    execute: async ({ agent, task }: { agent: string; task: string }) => {
      // This is handled by the orchestrator
      return { delegated: true, agent, task };
    },
  },
  
  requestHumanReview: {
    description: 'Request human review for important decisions',
    inputSchema: z.object({
      reason: z.string(),
      data: z.record(z.unknown()),
    }),
    execute: async ({ reason, data }: { reason: string; data: Record<string, unknown> }) => {
      return { 
        status: 'pending_review', 
        reason, 
        data,
        message: 'Human review requested. Workflow paused.',
      };
    },
  },
  
  finalizeCampaign: {
    description: 'Mark campaign as ready for deployment',
    inputSchema: z.object({
      campaignData: z.record(z.unknown()),
      complianceApproved: z.boolean(),
    }),
    execute: async ({ campaignData, complianceApproved }: { campaignData: Record<string, unknown>; complianceApproved: boolean }) => {
      return {
        status: complianceApproved ? 'ready' : 'pending_compliance',
        campaign: campaignData,
      };
    },
  },
};

// ============================================================================
// Multi-Agent Orchestrator
// ============================================================================

export interface OrchestratorInput {
  task: string;
  workspaceId: string;
  maxRounds?: number;
}

export interface OrchestratorResult {
  success: boolean;
  rounds: number;
  finalOutput: unknown;
  agentMessages: AgentMessage[];
  humanReviewRequired?: boolean;
  reviewReason?: string;
}

/**
 * Run multi-agent orchestration for a complex task
 */
export async function runMultiAgentOrchestrator(
  input: OrchestratorInput
): Promise<OrchestratorResult> {
  const { task, maxRounds = 5 } = input;
  
  const context: AgentContext = {
    messages: [],
    sharedData: {},
  };
  
  let rounds = 0;
  let finalOutput: unknown = null;
  let humanReviewRequired = false;
  let reviewReason: string | undefined;
  
  while (rounds < maxRounds) {
    rounds++;
    
    // Supervisor decides what to do next
    const { text, toolCalls, toolResults } = await generateText({
      model: MODELS.REASONING,
      system: `You are Sako's Campaign Orchestrator Supervisor. You coordinate specialist 
agents to create compliant, high-converting marketing campaigns.

Available specialists:
- research: Finds evidence and analyzes competitors
- compliance: Validates claims and suggests rewrites  
- creative: Writes compelling copy

Your job is to:
1. Break down the campaign task into subtasks
2. Delegate to the right specialist
3. Review their output and iterate
4. Request human review for high-risk decisions
5. Finalize when the campaign is complete

Current context:
${context.messages.slice(-10).map(m => `${m.from}: ${m.content}`).join('\n')}`,
      prompt: rounds === 1 
        ? `New campaign task: ${task}`
        : `Continue orchestration. Review latest results and decide next step.`,
      tools: supervisorTools,
    });
    
    // Process tool calls
    if (toolCalls?.length) {
      for (const toolCall of toolCalls) {
        // Cast to access input property (AI SDK 6 uses 'input' instead of 'args')
        const call = toolCall as { toolName: string; input?: Record<string, unknown> };
        
        if (call.toolName === 'delegateToAgent') {
          const { agent, task: agentTask } = (call.input || {}) as { agent: AgentName; task: string };
          
          let agentResult: { result: unknown; messages: AgentMessage[] };
          
          switch (agent) {
            case 'research':
              agentResult = await runResearchAgent(agentTask, context);
              break;
            case 'compliance':
              agentResult = await runComplianceAgent(agentTask, context);
              break;
            case 'creative':
              agentResult = await runCreativeAgent(agentTask, context);
              break;
          }
          
          context.messages.push(...agentResult.messages);
          context.sharedData[`${agent}_result`] = agentResult.result;
        }
        
        if (call.toolName === 'requestHumanReview') {
          humanReviewRequired = true;
          reviewReason = (call.input as any)?.reason;
          finalOutput = context.sharedData;
          break;
        }
        
        if (call.toolName === 'finalizeCampaign') {
          finalOutput = (call.input as any)?.campaignData;
          return {
            success: true,
            rounds,
            finalOutput,
            agentMessages: context.messages,
            humanReviewRequired: false,
          };
        }
      }
    }
    
    // Add supervisor message
    context.messages.push({
      from: 'supervisor',
      to: 'all',
      content: text,
      timestamp: new Date(),
    });
    
    if (humanReviewRequired) break;
  }
  
  return {
    success: !humanReviewRequired && rounds < maxRounds,
    rounds,
    finalOutput: finalOutput || context.sharedData,
    agentMessages: context.messages,
    humanReviewRequired,
    reviewReason,
  };
}

// ============================================================================
// Exports
// ============================================================================

export { 
  runResearchAgent, 
  runComplianceAgent, 
  runCreativeAgent,
  supervisorTools,
};
