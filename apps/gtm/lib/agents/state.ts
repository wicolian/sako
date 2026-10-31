import type { Campaign, Angle, PageBlock } from '@/lib/supabase/types'

export type AgentStep =
  | 'parse_brief'
  | 'generate_campaign'
  | 'generate_angles'
  | 'select_angle'
  | 'build_page'
  | 'validate_claims'
  | 'auto_fix'
  | 'deploy'
  | 'complete'
  | 'error'
  | 'waiting_approval'

export interface StepResult {
  step: AgentStep
  result: unknown
  timestamp: Date
  durationMs?: number
}

export interface ClaimValidationResult {
  id: string
  text: string
  status: 'approved' | 'blocked' | 'needs_proof'
  riskScore: number
  reasonCodes: string[]
  suggestedRewrite?: string
}

export interface DeployResult {
  success: boolean
  provider: string
  liveUrl?: string
  error?: string
  deploymentId?: string
}

export interface AgentState {
  // Input
  briefText: string
  workspaceId: string
  userId: string

  // Parsed campaign details
  campaign?: Partial<Campaign>

  // Generated content
  angles?: Angle[]
  selectedAngle?: Angle
  pageBlocks?: PageBlock[]

  // Validation
  claimResults?: ClaimValidationResult[]
  trustScore?: number
  needsReview?: boolean

  // Deployment
  deploymentResult?: DeployResult
  liveUrl?: string

  // Flow control
  currentStep: AgentStep
  stepHistory: StepResult[]
  error?: string
  iterationCount: number

  // User preferences
  targetProvider?: string
  autoFix?: boolean
  skipReview?: boolean
}

export const AGENT_STEPS: { id: AgentStep; label: string; description: string }[] = [
  { id: 'parse_brief', label: 'Parse Brief', description: 'Understanding your requirements' },
  { id: 'generate_campaign', label: 'Create Campaign', description: 'Setting up campaign structure' },
  { id: 'generate_angles', label: 'Generate Angles', description: 'Creating marketing approaches' },
  { id: 'build_page', label: 'Build Page', description: 'Designing landing page blocks' },
  { id: 'validate_claims', label: 'Validate Claims', description: 'Checking compliance' },
  { id: 'deploy', label: 'Deploy', description: 'Publishing to your provider' },
  { id: 'complete', label: 'Complete', description: 'Campaign is live!' },
]

export function createInitialState(
  briefText: string,
  workspaceId: string,
  userId: string,
  options?: { targetProvider?: string; autoFix?: boolean; skipReview?: boolean }
): AgentState {
  return {
    briefText,
    workspaceId,
    userId,
    currentStep: 'parse_brief',
    stepHistory: [],
    iterationCount: 0,
    targetProvider: options?.targetProvider || 'hubspot',
    autoFix: options?.autoFix ?? true,
    skipReview: options?.skipReview ?? false,
  }
}
