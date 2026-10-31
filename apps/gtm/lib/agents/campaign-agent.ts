import type { AgentState, StepResult } from './state'
import { parseBrief } from './steps/parse-brief'
import { generateAngles } from './steps/generate-angles'
import { buildPage } from './steps/build-page'
import { validateClaimsStep } from './steps/validate'
import { autoFix } from './steps/auto-fix'
import { deployStep } from './steps/deploy'

export type AgentEventType =
  | 'step_start'
  | 'step_complete'
  | 'step_error'
  | 'complete'
  | 'error'
  | 'waiting_approval'

export interface AgentEvent {
  type: AgentEventType
  step?: string
  result?: StepResult
  state?: Partial<AgentState>
  error?: string
  liveUrl?: string
}

export type AgentEventCallback = (event: AgentEvent) => void

/**
 * Run the campaign agent as a state machine
 */
export async function runCampaignAgent(
  initialState: AgentState,
  onEvent: AgentEventCallback
): Promise<AgentState> {
  let state = { ...initialState }

  while (
    state.currentStep !== 'complete' &&
    state.currentStep !== 'error' &&
    state.currentStep !== 'waiting_approval'
  ) {
    const currentStep = state.currentStep

    // Emit step start
    onEvent({
      type: 'step_start',
      step: currentStep,
    })

    try {
      // Execute the step
      const updates = await executeStep(state)
      state = { ...state, ...updates }

      // Get the step result
      const stepResult = state.stepHistory[state.stepHistory.length - 1]

      // Emit step complete
      onEvent({
        type: 'step_complete',
        step: currentStep,
        result: stepResult,
        state: {
          currentStep: state.currentStep,
          trustScore: state.trustScore,
          liveUrl: state.liveUrl,
        },
      })
    } catch (error) {
      state = {
        ...state,
        currentStep: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      }

      onEvent({
        type: 'step_error',
        step: currentStep,
        error: state.error,
      })
    }
  }

  // Emit final event
  if (state.currentStep === 'complete') {
    onEvent({
      type: 'complete',
      liveUrl: state.liveUrl,
      state: {
        campaign: state.campaign,
        trustScore: state.trustScore,
        deploymentResult: state.deploymentResult,
      },
    })
  } else if (state.currentStep === 'waiting_approval') {
    onEvent({
      type: 'waiting_approval',
      state: {
        claimResults: state.claimResults,
        trustScore: state.trustScore,
        pageBlocks: state.pageBlocks,
      },
    })
  } else if (state.currentStep === 'error') {
    onEvent({
      type: 'error',
      error: state.error,
    })
  }

  return state
}

async function executeStep(state: AgentState): Promise<Partial<AgentState>> {
  switch (state.currentStep) {
    case 'parse_brief':
      return parseBrief(state)

    case 'generate_angles':
      return generateAngles(state)

    case 'build_page':
      return buildPage(state)

    case 'validate_claims':
      return validateClaimsStep(state)

    case 'auto_fix':
      return autoFix(state)

    case 'deploy':
      return deployStep(state)

    default:
      return {
        currentStep: 'error',
        error: `Unknown step: ${state.currentStep}`,
      }
  }
}

/**
 * Resume agent from waiting_approval state
 */
export async function resumeAgentAfterApproval(
  state: AgentState,
  approved: boolean,
  onEvent: AgentEventCallback
): Promise<AgentState> {
  if (state.currentStep !== 'waiting_approval') {
    throw new Error('Agent is not waiting for approval')
  }

  if (approved) {
    state = { ...state, currentStep: 'deploy', skipReview: true }
  } else {
    state = { ...state, currentStep: 'error', error: 'Deployment rejected by user' }
  }

  return runCampaignAgent(state, onEvent)
}
