import { generateStructuredOutput } from '@/lib/ai/ai-sdk-client'
import { z } from 'zod'
import type { AgentState, StepResult } from '../state'
import type { Angle } from '@/lib/supabase/types'

const AnglesSchema = z.object({
  angles: z.array(
    z.object({
      name: z.string(),
      hook: z.string().describe('The main attention-grabbing message'),
      value_prop: z.string().describe('Core value proposition'),
      proof_points: z.array(z.string()).describe('Supporting evidence or claims'),
      emotional_trigger: z.string().describe('What emotion does this angle tap into'),
      estimated_trust_score: z.number().min(0).max(100),
    })
  ).min(2).max(4),
})

export async function generateAngles(state: AgentState): Promise<Partial<AgentState>> {
  const startTime = Date.now()

  if (!state.campaign) {
    return {
      currentStep: 'error',
      error: 'No campaign data found',
    }
  }

  const prompt = `
You are a senior marketing strategist. Generate 3 distinct marketing angles for this campaign.

Campaign Details:
- Name: ${state.campaign.name}
- Audience: ${state.campaign.audience}
- Goal: ${state.campaign.goal}
- Offer: ${state.campaign.offer}
- CTA: ${state.campaign.cta}

Each angle should:
1. Have a unique approach (e.g., pain-focused, benefit-focused, social proof, urgency)
2. Include a compelling hook
3. Have 2-3 proof points
4. Target a specific emotional trigger
5. Estimate a trust score (how likely to pass compliance)

Make angles specific and actionable, not generic marketing speak.
`

  try {
    const result = await generateStructuredOutput({
      prompt,
      schema: AnglesSchema,
    })

    const angles: Angle[] = result.angles.map((a, i) => ({
      id: `angle-${i}`,
      name: a.name,
      description: a.hook,
      rank: i,
      trust_score: a.estimated_trust_score,
      rationale: a.emotional_trigger,
      payload: {
        hook: a.hook,
        value_prop: a.value_prop,
        proof_points: a.proof_points,
      },
      campaign_id: '',
      created_at: new Date().toISOString(),
    }))

    // Auto-select the angle with highest trust score
    const bestAngle = result.angles.reduce((best, current) =>
      current.estimated_trust_score > (best?.estimated_trust_score || 0) ? current : best
    )

    const selectedAngle = angles.find(a => a.name === bestAngle.name) || angles[0]

    const stepResult: StepResult = {
      step: 'generate_angles',
      result: { angles, selectedAngle },
      timestamp: new Date(),
      durationMs: Date.now() - startTime,
    }

    return {
      angles,
      selectedAngle,
      currentStep: 'build_page',
      stepHistory: [...state.stepHistory, stepResult],
    }
  } catch (error) {
    return {
      currentStep: 'error',
      error: `Failed to generate angles: ${error instanceof Error ? error.message : 'Unknown error'}`,
      stepHistory: [
        ...state.stepHistory,
        {
          step: 'generate_angles',
          result: { error: true },
          timestamp: new Date(),
          durationMs: Date.now() - startTime,
        },
      ],
    }
  }
}
