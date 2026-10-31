import { generateStructuredOutput } from '@/lib/ai/ai-sdk-client'
import { z } from 'zod'
import type { AgentState, StepResult } from '../state'

const CampaignBriefSchema = z.object({
  name: z.string().describe('Campaign name derived from brief'),
  audience: z.string().describe('Target audience'),
  goal: z.string().describe('Primary campaign goal'),
  offer: z.string().describe('What is being offered'),
  cta: z.string().describe('Primary call-to-action text'),
  keyBenefits: z.array(z.string()).max(5).describe('Key benefits to highlight'),
  tone: z.enum(['professional', 'casual', 'urgent', 'friendly', 'technical']),
  contentType: z.enum(['landing_page', 'email', 'ad', 'multi']),
})

export async function parseBrief(state: AgentState): Promise<Partial<AgentState>> {
  const startTime = Date.now()

  const prompt = `
You are an expert marketing strategist. Parse this campaign brief into structured fields.

<brief>
${state.briefText}
</brief>

Extract the key elements. If something is not specified, make a reasonable inference based on context.
Be specific and actionable with the extracted information.
`

  try {
    const parsed = await generateStructuredOutput({
      prompt,
      schema: CampaignBriefSchema,
    })

    const stepResult: StepResult = {
      step: 'parse_brief',
      result: parsed,
      timestamp: new Date(),
      durationMs: Date.now() - startTime,
    }

    return {
      campaign: {
        name: parsed.name,
        audience: parsed.audience,
        goal: parsed.goal,
        offer: parsed.offer,
        cta: parsed.cta,
      },
      currentStep: 'generate_angles',
      stepHistory: [...state.stepHistory, stepResult],
    }
  } catch (error) {
    return {
      currentStep: 'error',
      error: `Failed to parse brief: ${error instanceof Error ? error.message : 'Unknown error'}`,
      stepHistory: [
        ...state.stepHistory,
        {
          step: 'parse_brief',
          result: { error: true },
          timestamp: new Date(),
          durationMs: Date.now() - startTime,
        },
      ],
    }
  }
}
