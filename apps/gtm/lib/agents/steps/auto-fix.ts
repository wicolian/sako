import { generateCompliantRewrites } from '@/lib/ai/ai-sdk-client'
import type { AgentState, StepResult } from '../state'
import type { PageBlock } from '@/lib/supabase/types'

export async function autoFix(state: AgentState): Promise<Partial<AgentState>> {
  const startTime = Date.now()

  if (!state.claimResults || !state.pageBlocks) {
    return {
      currentStep: 'error',
      error: 'No claims to fix',
    }
  }

  // Find claims that need fixing
  const claimsToFix = state.claimResults.filter(
    (c) => c.status === 'blocked' || c.status === 'needs_proof'
  )

  if (claimsToFix.length === 0) {
    // Nothing to fix, proceed to deploy
    return {
      currentStep: 'deploy',
      stepHistory: [
        ...state.stepHistory,
        {
          step: 'auto_fix',
          result: { fixed: 0, message: 'No claims needed fixing' },
          timestamp: new Date(),
          durationMs: Date.now() - startTime,
        },
      ],
    }
  }

  try {
    // Generate rewrites
    const rewrites = await generateCompliantRewrites(
      claimsToFix.map((c) => ({
        text: c.text,
        reasonCode: c.reasonCodes[0] || 'compliance_issue',
        category: 'generic',
      })),
      {
        mode: 'standard',
        forbiddenTerms: [],
      }
    )

    // Create a map of original text -> rewritten text
    const rewriteMap = new Map<string, string>()
    rewrites.rewrites.forEach((r) => {
      if (r.rewritten) {
        rewriteMap.set(r.original, r.rewritten)
      }
    })

    // Apply rewrites to page blocks
    const updatedBlocks = state.pageBlocks.map((block) => {
      const props = { ...(block.props as Record<string, unknown>) }

      // Replace text in common props
      const textProps = ['headline', 'subheadline', 'title', 'description', 'cta_text', 'body']
      textProps.forEach((prop) => {
        if (typeof props[prop] === 'string' && rewriteMap.has(props[prop] as string)) {
          props[prop] = rewriteMap.get(props[prop] as string)
        }
      })

      // Replace in arrays
      if (Array.isArray(props.items)) {
        props.items = props.items.map((item: unknown) => {
          if (typeof item === 'object' && item !== null) {
            const itemObj = { ...(item as Record<string, unknown>) }
            if (typeof itemObj.title === 'string' && rewriteMap.has(itemObj.title)) {
              itemObj.title = rewriteMap.get(itemObj.title)
            }
            if (typeof itemObj.description === 'string' && rewriteMap.has(itemObj.description)) {
              itemObj.description = rewriteMap.get(itemObj.description)
            }
            return itemObj
          }
          return item
        })
      }

      return { ...block, props: props as PageBlock['props'] }
    }) as PageBlock[]

    const stepResult: StepResult = {
      step: 'auto_fix',
      result: {
        fixed: rewriteMap.size,
        rewrites: Array.from(rewriteMap.entries()).map(([orig, fixed]) => ({
          original: orig,
          fixed,
        })),
      },
      timestamp: new Date(),
      durationMs: Date.now() - startTime,
    }

    // Re-validate after fixing
    return {
      pageBlocks: updatedBlocks,
      currentStep: 'validate_claims',
      stepHistory: [...state.stepHistory, stepResult],
    }
  } catch (error) {
    return {
      currentStep: 'error',
      error: `Auto-fix failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      stepHistory: [
        ...state.stepHistory,
        {
          step: 'auto_fix',
          result: { error: true },
          timestamp: new Date(),
          durationMs: Date.now() - startTime,
        },
      ],
    }
  }
}
