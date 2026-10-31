import { generateStructuredOutput } from '@/lib/ai/ai-sdk-client'
import { z } from 'zod'
import type { AgentState, StepResult } from '../state'
import type { PageBlock } from '@/lib/supabase/types'

const PageBlocksSchema = z.object({
  blocks: z.array(
    z.object({
      type: z.enum(['hero', 'trust', 'benefits', 'features', 'testimonials', 'faq', 'footer_cta']),
      props: z.record(z.unknown()),
    })
  ),
})

export async function buildPage(state: AgentState): Promise<Partial<AgentState>> {
  const startTime = Date.now()

  if (!state.campaign || !state.selectedAngle) {
    return {
      currentStep: 'error',
      error: 'Missing campaign or angle data',
    }
  }

  // Extract angle payload data
  const anglePayload = (state.selectedAngle.payload as Record<string, unknown>) || {}

  const prompt = `
You are a landing page expert. Create a high-converting landing page structure for this campaign.

Campaign: ${state.campaign.name}
Audience: ${state.campaign.audience}
Goal: ${state.campaign.goal}
CTA: ${state.campaign.cta}

Selected Marketing Angle:
- Name: ${state.selectedAngle.name}
- Description: ${state.selectedAngle.description || 'N/A'}
- Trust Score: ${state.selectedAngle.trust_score}
${anglePayload.hook ? `- Hook: ${anglePayload.hook}` : ''}
${anglePayload.value_prop ? `- Value Prop: ${anglePayload.value_prop}` : ''}
${Array.isArray(anglePayload.proof_points) ? `- Proof Points: ${(anglePayload.proof_points as string[]).join(', ')}` : ''}

Generate page blocks in this order:
1. hero - Main headline, subheadline, CTA
2. trust - Company logos or trust badges
3. benefits - 3-4 key benefits with icons
4. features - Product features with descriptions
5. testimonials - Social proof quotes
6. faq - Common questions
7. footer_cta - Final call to action

For each block, provide realistic content props (headlines, descriptions, items, etc).
Make the copy compelling and specific to this campaign.
`

  try {
    const result = await generateStructuredOutput({
      prompt,
      schema: PageBlocksSchema,
    })

    const pageBlocks: PageBlock[] = result.blocks.map((block, i) => ({
      id: `block-${i}`,
      campaign_id: '',
      angle_id: null,
      type: block.type as PageBlock['type'],
      order: i,
      props: block.props as PageBlock['props'],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }))

    const stepResult: StepResult = {
      step: 'build_page',
      result: { blockCount: pageBlocks.length, blocks: pageBlocks },
      timestamp: new Date(),
      durationMs: Date.now() - startTime,
    }

    return {
      pageBlocks,
      currentStep: 'validate_claims',
      stepHistory: [...state.stepHistory, stepResult],
    }
  } catch (error) {
    return {
      currentStep: 'error',
      error: `Failed to build page: ${error instanceof Error ? error.message : 'Unknown error'}`,
      stepHistory: [
        ...state.stepHistory,
        {
          step: 'build_page',
          result: { error: true },
          timestamp: new Date(),
          durationMs: Date.now() - startTime,
        },
      ],
    }
  }
}
