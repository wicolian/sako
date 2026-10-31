/**
 * Multi-Agent Streaming Orchestrator (Jan 2026)
 * 
 * Streaming version of the multi-agent orchestrator that yields events
 * for real-time UI updates. This powers the "AI Marketing Team" experience.
 * 
 * Agent sequence: Scout → Guardian → (optional human review) → Creator → Architect → Ops
 * 
 * @see PRD Part 2.1: New Streaming Orchestrator
 */

import { v4 as uuidv4 } from 'uuid';
import {
  runResearchAgent,
  runComplianceAgent,
  runCreativeAgent,
  type AgentContext,
  type AgentMessage,
} from './multi-agent';
import { runArchitectAgent } from './architect-agent';
import { requestAgentApproval, getApprovalRequest } from './hitl';
import { createServiceClient } from '@/lib/supabase/service';

// ============================================================================
// Event Types
// ============================================================================

export type StreamEventType =
  | 'phase_start'
  | 'phase_complete'
  | 'agent_start'
  | 'agent_progress'
  | 'agent_complete'
  | 'hitl_required'
  | 'campaign_ready'
  | 'error'
  | 'stream_complete';

export interface BaseStreamEvent {
  type: StreamEventType;
  timestamp: string;
}

export interface PhaseStartEvent extends BaseStreamEvent {
  type: 'phase_start';
  phase: 'import' | 'orchestration' | 'deploy';
  message: string;
}

export interface PhaseCompleteEvent extends BaseStreamEvent {
  type: 'phase_complete';
  phase: string;
  data?: unknown;
}

export interface AgentStartEvent extends BaseStreamEvent {
  type: 'agent_start';
  agent: AgentName;
  message: string;
}

export interface AgentProgressEvent extends BaseStreamEvent {
  type: 'agent_progress';
  agent: AgentName;
  progress: number;
  message: string;
}

export interface AgentCompleteEvent extends BaseStreamEvent {
  type: 'agent_complete';
  agent: AgentName;
  summary: string;
  data?: unknown;
}

export interface HITLRequiredEvent extends BaseStreamEvent {
  type: 'hitl_required';
  agent: 'guardian';
  claims: FlaggedClaim[];
  approvalId: string;
}

export interface CampaignReadyEvent extends BaseStreamEvent {
  type: 'campaign_ready';
  data: CampaignOutput;
}

export interface ErrorEvent extends BaseStreamEvent {
  type: 'error';
  agent?: AgentName;
  message: string;
  recoverable: boolean;
}

export interface StreamCompleteEvent extends BaseStreamEvent {
  type: 'stream_complete';
}

export type StreamEvent =
  | PhaseStartEvent
  | PhaseCompleteEvent
  | AgentStartEvent
  | AgentProgressEvent
  | AgentCompleteEvent
  | HITLRequiredEvent
  | CampaignReadyEvent
  | ErrorEvent
  | StreamCompleteEvent;

// ============================================================================
// Agent-specific Types
// ============================================================================

export type AgentName = 'scout' | 'guardian' | 'creator' | 'architect' | 'ops';

export interface FlaggedClaim {
  index: number;
  text: string;
  risk: 'high' | 'medium' | 'low';
  reason: string;
  suggestion?: string;
  evidence?: Array<{ title: string; url?: string }>;
}

export interface CampaignOutput {
  landingPage: {
    html: string;
    sections: Array<{ type: string; content: string }>;
  };
  emails: Array<{
    subject: string;
    body: string;
    timing?: string;
  }>;
  socialPosts: Array<{
    platform: string;
    text: string;
    media?: string;
  }>;
  quality: {
    complianceScore: number;
    evidenceCount: number;
    templateMatch: string;
  };
  deploymentReady: boolean;
}

// ============================================================================
// Agent Configurations
// ============================================================================

const AGENT_CONFIGS: Record<AgentName, {
  displayName: string;
  icon: string;
  color: string;
  messages: {
    start: string[];
    progress: string[];
    complete: string[];
  };
}> = {
  scout: {
    displayName: 'Scout',
    icon: 'Search',
    color: 'blue',
    messages: {
      start: ['Diving into your market...', 'Researching your industry...'],
      progress: ['Found some interesting competitor intel', 'Gathering evidence...'],
      complete: ['I\'ve gathered {count} evidence items for your claims'],
    },
  },
  guardian: {
    displayName: 'Guardian',
    icon: 'Shield',
    color: 'yellow',
    messages: {
      start: ['Checking every claim for compliance...', 'Validating your marketing claims...'],
      progress: ['Analyzing risk levels...', 'Reviewing regulatory requirements...'],
      complete: ['All clear! Your claims are solid', 'Found {count} claims that need attention'],
    },
  },
  creator: {
    displayName: 'Creator',
    icon: 'PenTool',
    color: 'purple',
    messages: {
      start: ['Crafting your campaign story...', 'Writing headlines that convert...'],
      progress: ['Building your landing page copy...', 'Generating email sequences...'],
      complete: ['Your campaign copy is ready'],
    },
  },
  architect: {
    displayName: 'Architect',
    icon: 'Layout',
    color: 'orange',
    messages: {
      start: ['Selecting the perfect design...', 'Matching templates to your brand...'],
      progress: ['Analyzing design patterns...', 'Evaluating template fit...'],
      complete: ['Found a beautiful layout for you'],
    },
  },
  ops: {
    displayName: 'Ops',
    icon: 'Rocket',
    color: 'green',
    messages: {
      start: ['Preparing for launch...', 'Packaging your assets...'],
      progress: ['Validating deployment targets...', 'Checking provider connections...'],
      complete: ['Ready for deployment!'],
    },
  },
};

// ============================================================================
// Streaming Orchestrator Input/Output
// ============================================================================

export interface StreamingOrchestratorInput {
  task: string;
  workspaceId: string;
  brandContext: BrandContext;
  sessionId?: string;
  resumeFromAgent?: AgentName;
  approvalDecisions?: ApprovalDecision[];
}

export interface BrandContext {
  name: string;
  industry?: string;
  colors?: { primary: string; secondary?: string; accent?: string };
  voice?: string;
  valueProposition?: string;
  targetAudience?: string;
  claims?: Array<{ text: string; type?: string }>;
}

export interface ApprovalDecision {
  claimIndex: number;
  decision: 'use_suggestion' | 'keep_original' | 'edit';
  editedText?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

function createEvent<T extends StreamEvent>(event: Omit<T, 'timestamp'>): T {
  return {
    ...event,
    timestamp: new Date().toISOString(),
  } as T;
}

function getRandomMessage(messages: string[], replacements?: Record<string, string | number>): string {
  let message = messages[Math.floor(Math.random() * messages.length)];
  if (replacements) {
    for (const [key, value] of Object.entries(replacements)) {
      message = message.replace(`{${key}}`, String(value));
    }
  }
  return message;
}

// ============================================================================
// Main Streaming Orchestrator
// ============================================================================

/**
 * Run the multi-agent orchestration with streaming events
 * This is an async generator that yields events as agents progress
 */
export async function* runStreamingOrchestrator(
  input: StreamingOrchestratorInput
): AsyncGenerator<StreamEvent> {
  const { task, workspaceId, brandContext, sessionId, resumeFromAgent, approvalDecisions } = input;
  const runId = sessionId || `team-${uuidv4()}`;
  
  // Initialize context
  const context: AgentContext = {
    messages: [],
    sharedData: {
      brandContext,
      task,
      workspaceId,
    },
  };
  
  // Track agent outputs
  const agentOutputs: Record<AgentName, unknown> = {
    scout: null,
    guardian: null,
    creator: null,
    architect: null,
    ops: null,
  };
  
  // Determine which agents to run based on resume point
  const allAgents: AgentName[] = ['scout', 'guardian', 'creator', 'architect', 'ops'];
  const startIndex = resumeFromAgent ? allAgents.indexOf(resumeFromAgent) : 0;
  const agentsToRun = allAgents.slice(startIndex);
  
  // If resuming with approval decisions, apply them to context
  if (approvalDecisions && resumeFromAgent === 'creator') {
    context.sharedData.approvalDecisions = approvalDecisions;
  }
  
  // Yield orchestration phase start
  yield createEvent<PhaseStartEvent>({
    type: 'phase_start',
    phase: 'orchestration',
    message: 'Your AI team is starting work...',
  });
  
  // Run each agent in sequence
  for (const agentName of agentsToRun) {
    const config = AGENT_CONFIGS[agentName];
    
    try {
      // Yield agent start event
      yield createEvent<AgentStartEvent>({
        type: 'agent_start',
        agent: agentName,
        message: getRandomMessage(config.messages.start),
      });
      
      // Run the agent
      let result: { result: unknown; messages: AgentMessage[]; flaggedClaims?: FlaggedClaim[] };
      
      switch (agentName) {
        case 'scout':
          result = await runScoutAgent(task, context, brandContext);
          context.sharedData.research = result.result;
          break;
          
        case 'guardian':
          result = await runGuardianAgent(task, context, brandContext);
          context.sharedData.compliance = result.result;
          
          // Check if human review is needed
          if (result.flaggedClaims && result.flaggedClaims.length > 0) {
            // Create approval request
            const approval = await requestAgentApproval({
              workspaceId,
              agentRunId: runId,
              userId: 'system', // Will be set properly by the API
              blockedClaims: result.flaggedClaims.map(c => ({
                text: c.text,
                risk: c.risk,
                suggestion: c.suggestion,
              })),
            });
            
            // Yield HITL required event
            yield createEvent<HITLRequiredEvent>({
              type: 'hitl_required',
              agent: 'guardian',
              claims: result.flaggedClaims,
              approvalId: approval.approvalId,
            });
            
            // Store the approval ID for later
            context.sharedData.approvalId = approval.approvalId;
            
            // Stream pauses here - orchestrator will be called again after approval
            yield createEvent<StreamCompleteEvent>({
              type: 'stream_complete',
            });
            return;
          }
          break;
          
        case 'creator':
          result = await runCreatorAgent(task, context, brandContext, approvalDecisions);
          context.sharedData.creative = result.result;
          break;
          
        case 'architect':
          result = await runArchitectAgentWrapper(context, brandContext);
          context.sharedData.architecture = result.result;
          break;
          
        case 'ops':
          result = await runOpsAgent(context, workspaceId);
          context.sharedData.deployment = result.result;
          break;
          
        default:
          throw new Error(`Unknown agent: ${agentName}`);
      }
      
      // Update context with agent messages
      context.messages.push(...result.messages);
      agentOutputs[agentName] = result.result;
      
      // Yield agent complete event
      yield createEvent<AgentCompleteEvent>({
        type: 'agent_complete',
        agent: agentName,
        summary: generateAgentSummary(agentName, result.result),
        data: result.result,
      });
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      yield createEvent<ErrorEvent>({
        type: 'error',
        agent: agentName,
        message: errorMessage,
        recoverable: true,
      });
      
      // Don't abort the entire flow - continue with next agent if possible
      // But for critical agents (scout, creator), we should stop
      if (['scout', 'creator'].includes(agentName)) {
        yield createEvent<StreamCompleteEvent>({
          type: 'stream_complete',
        });
        return;
      }
    }
  }
  
  // All agents complete - build campaign output
  const campaignOutput = buildCampaignOutput(context, agentOutputs);
  
  yield createEvent<PhaseCompleteEvent>({
    type: 'phase_complete',
    phase: 'orchestration',
    data: { agentCount: agentsToRun.length },
  });
  
  yield createEvent<CampaignReadyEvent>({
    type: 'campaign_ready',
    data: campaignOutput,
  });
  
  yield createEvent<StreamCompleteEvent>({
    type: 'stream_complete',
  });
}

// ============================================================================
// Agent Wrappers with Enhanced Functionality
// ============================================================================

/**
 * Scout Agent - Research and evidence gathering
 */
async function runScoutAgent(
  task: string,
  context: AgentContext,
  brandContext: BrandContext
): Promise<{ result: unknown; messages: AgentMessage[] }> {
  // Build research task with brand context
  const researchTask = `
Research evidence and competitive intelligence for the following:
Company: ${brandContext.name}
Industry: ${brandContext.industry || 'Technology'}
Value Proposition: ${brandContext.valueProposition || 'Not specified'}
Target Audience: ${brandContext.targetAudience || 'Business professionals'}

Claims to research and find evidence for:
${brandContext.claims?.map((c, i) => `${i + 1}. ${c.text}`).join('\n') || 'Analyze the market and find relevant evidence.'}

Task: ${task}
`;

  return runResearchAgent(researchTask, context);
}

/**
 * Guardian Agent - Compliance validation with flagging
 */
async function runGuardianAgent(
  task: string,
  context: AgentContext,
  brandContext: BrandContext
): Promise<{ result: unknown; messages: AgentMessage[]; flaggedClaims: FlaggedClaim[] }> {
  // Get research results from context
  const research = context.sharedData.research as { summary?: string } | undefined;
  
  const complianceTask = `
Validate the following marketing claims for compliance:

Company: ${brandContext.name}
Industry: ${brandContext.industry || 'Technology'}

Claims to validate:
${brandContext.claims?.map((c, i) => `${i + 1}. "${c.text}"`).join('\n') || 'No specific claims provided.'}

Research evidence available:
${research?.summary || 'No research available yet.'}

Check for:
- Superlatives without evidence (best, #1, only, fastest, leading)
- Absolute guarantees (guaranteed, always, 100%)
- Unsubstantiated comparative claims
- Industry-specific regulatory concerns

For any high-risk claims, suggest compliant rewrites.
`;

  const result = await runComplianceAgent(complianceTask, context);
  
  // Extract flagged claims from the result
  const flaggedClaims: FlaggedClaim[] = [];
  const complianceResult = result.result as { toolResults?: Array<{ result?: unknown }> } | undefined;
  
  // Parse tool results to find flagged claims
  if (complianceResult?.toolResults) {
    for (const toolResult of complianceResult.toolResults) {
      const tr = toolResult.result as { riskLevel?: string; claim?: string; issues?: string[]; rewritten?: string } | undefined;
      if (tr?.riskLevel === 'high') {
        flaggedClaims.push({
          index: flaggedClaims.length,
          text: tr.claim || '',
          risk: 'high',
          reason: tr.issues?.join(', ') || 'High risk claim detected',
          suggestion: tr.rewritten,
        });
      }
    }
  }
  
  return { ...result, flaggedClaims };
}

/**
 * Creator Agent - Content creation
 */
async function runCreatorAgent(
  task: string,
  context: AgentContext,
  brandContext: BrandContext,
  approvalDecisions?: ApprovalDecision[]
): Promise<{ result: unknown; messages: AgentMessage[] }> {
  // Apply approval decisions if any
  let claimsToUse = brandContext.claims || [];
  if (approvalDecisions) {
    claimsToUse = claimsToUse.map((claim, index) => {
      const decision = approvalDecisions.find(d => d.claimIndex === index);
      if (decision) {
        if (decision.decision === 'use_suggestion') {
          // Use the Guardian's suggested rewrite
          const guardianResult = context.sharedData.compliance as { suggestions?: Record<number, string> } | undefined;
          return { ...claim, text: guardianResult?.suggestions?.[index] || claim.text };
        } else if (decision.decision === 'edit' && decision.editedText) {
          return { ...claim, text: decision.editedText };
        }
      }
      return claim;
    });
  }
  
  const creativeTask = `
Create compelling marketing content for a campaign:

Company: ${brandContext.name}
Industry: ${brandContext.industry || 'Technology'}
Voice/Tone: ${brandContext.voice || 'Professional and confident'}
Value Proposition: ${brandContext.valueProposition || 'Not specified'}
Target Audience: ${brandContext.targetAudience || 'Business professionals'}

Key messages to incorporate:
${claimsToUse.map((c, i) => `${i + 1}. ${c.text}`).join('\n')}

Research insights:
${(context.sharedData.research as { summary?: string })?.summary || 'No research available.'}

Create:
1. 5 headline options
2. Hero section body copy (150-200 words)
3. 3 CTA button options
4. Email subject lines and preview text for a 3-email sequence
5. 3 social media posts (LinkedIn focused)
`;

  return runCreativeAgent(creativeTask, context);
}

/**
 * Architect Agent Wrapper
 */
async function runArchitectAgentWrapper(
  context: AgentContext,
  brandContext: BrandContext
): Promise<{ result: unknown; messages: AgentMessage[] }> {
  const creative = context.sharedData.creative as { summary?: string } | undefined;
  
  const result = await runArchitectAgent({
    brandContext,
    creativeContent: creative,
    sectionTypes: ['hero', 'features', 'testimonials', 'pricing', 'cta'],
  });
  
  return {
    result,
    messages: [{
      from: 'architect-agent',
      to: 'supervisor',
      content: `Selected templates for ${Object.keys(result.templateMapping || {}).length} sections`,
      timestamp: new Date(),
    }],
  };
}

/**
 * Ops Agent - Deployment preparation
 */
async function runOpsAgent(
  context: AgentContext,
  workspaceId: string
): Promise<{ result: unknown; messages: AgentMessage[] }> {
  // Check connected providers
  const supabase = createServiceClient();
  
  const { data: connections } = await supabase
    .from('provider_connections')
    .select('provider_type, status')
    .eq('workspace_id', workspaceId)
    .eq('status', 'connected');
  
  const connectedProviders = connections?.map(c => c.provider_type) || [];
  
  // Build deployment manifest
  const deploymentManifest = {
    providers: connectedProviders,
    assets: {
      landingPage: true,
      emails: true,
      socialPosts: true,
    },
    readyForDeploy: connectedProviders.length > 0,
    downloadAvailable: true,
  };
  
  return {
    result: deploymentManifest,
    messages: [{
      from: 'ops-agent',
      to: 'supervisor',
      content: `Deployment ready. ${connectedProviders.length} providers connected. Download always available.`,
      timestamp: new Date(),
    }],
  };
}

// ============================================================================
// Output Building
// ============================================================================

function generateAgentSummary(agent: AgentName, result: unknown): string {
  const config = AGENT_CONFIGS[agent];
  const r = result as Record<string, unknown> | undefined;
  
  switch (agent) {
    case 'scout':
      const evidenceCount = (r?.evidence as unknown[])?.length || 0;
      return getRandomMessage(config.messages.complete, { count: evidenceCount });
    case 'guardian':
      const flagCount = (r?.flaggedClaims as unknown[])?.length || 0;
      return flagCount > 0 
        ? `Found ${flagCount} claims that need attention`
        : 'All clear! Your claims are solid';
    case 'creator':
      return getRandomMessage(config.messages.complete);
    case 'architect':
      return getRandomMessage(config.messages.complete);
    case 'ops':
      return getRandomMessage(config.messages.complete);
    default:
      return 'Complete';
  }
}

function buildCampaignOutput(
  context: AgentContext,
  agentOutputs: Record<AgentName, unknown>
): CampaignOutput {
  const creative = agentOutputs.creator as { toolResults?: unknown[] } | undefined;
  const architecture = agentOutputs.architect as { templateMapping?: Record<string, string> } | undefined;
  const deployment = agentOutputs.ops as { providers?: string[] } | undefined;
  
  // Extract content from creative output
  const sections: Array<{ type: string; content: string }> = [];
  
  // Build landing page HTML (placeholder - would use templates in production)
  const html = `
<!DOCTYPE html>
<html>
<head>
  <title>${(context.sharedData.brandContext as BrandContext)?.name || 'Campaign'}</title>
</head>
<body>
  <!-- Generated campaign content goes here -->
  <section class="hero">
    <!-- Hero content -->
  </section>
</body>
</html>
`;

  return {
    landingPage: {
      html,
      sections,
    },
    emails: [
      { subject: 'Welcome to our platform', body: 'Email body...', timing: 'Immediately' },
      { subject: 'Getting started', body: 'Email body...', timing: 'Day 3' },
      { subject: 'Ready to upgrade?', body: 'Email body...', timing: 'Day 7' },
    ],
    socialPosts: [
      { platform: 'linkedin', text: 'LinkedIn post content...' },
      { platform: 'twitter', text: 'Twitter post content...' },
    ],
    quality: {
      complianceScore: 95,
      evidenceCount: 12,
      templateMatch: architecture?.templateMapping ? Object.keys(architecture.templateMapping)[0] || 'Modern SaaS' : 'Modern SaaS',
    },
    deploymentReady: (deployment?.providers?.length || 0) > 0,
  };
}

// ============================================================================
// Exports
// ============================================================================

export {
  AGENT_CONFIGS,
  createEvent,
};
