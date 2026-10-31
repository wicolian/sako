/**
 * AI Actions
 * 
 * Common AI transformation actions for content.
 */

import { generateText } from '@/lib/ai/langsmith-ai'
import { MODELS } from './ai-sdk-client'
import { buildUnifiedContext, formatContextForPrompt } from '@/lib/context/unified-context'

export type AIAction = 
  | 'rewrite'
  | 'expand'
  | 'summarize'
  | 'repurpose'
  | 'translate'
  | 'change_tone'
  | 'simplify'

interface AIActionInput {
  content: string
  action: AIAction
  options?: Record<string, unknown>
  workspaceId?: string
  projectId?: string
  brandId?: string
  audienceId?: string
}

interface AIActionResult {
  success: boolean
  output?: string
  error?: string
}

/**
 * Execute an AI action on content
 */
export async function executeAIAction(input: AIActionInput): Promise<AIActionResult> {
  try {
    // Build context if workspace provided
    let contextPrompt = ''
    if (input.workspaceId) {
      const context = await buildUnifiedContext({
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        brandId: input.brandId,
        audienceId: input.audienceId,
        includeKnowledge: false, // Don't include knowledge for quick actions
      })
      contextPrompt = formatContextForPrompt(context)
    }

    // Build the prompt based on action
    const prompt = buildActionPrompt(input.action, input.content, input.options)

    // Generate with AI
    const result = await generateText({
      model: MODELS.FAST,
      system: buildSystemPrompt(input.action, contextPrompt),
      prompt,
      temperature: 0.7,
    })

    return {
      success: true,
      output: result.text,
    }
  } catch (error) {
    console.error('AI action failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Build system prompt for action
 */
function buildSystemPrompt(action: AIAction, contextPrompt: string): string {
  const parts: string[] = []

  parts.push('You are an expert content editor and writer.')
  parts.push('Your task is to transform the provided content according to the instructions.')
  parts.push('Maintain the core message while applying the requested transformation.')
  parts.push('Output only the transformed content, no explanations.')

  if (contextPrompt) {
    parts.push('')
    parts.push(contextPrompt)
  }

  return parts.join('\n')
}

/**
 * Build action-specific prompt
 */
function buildActionPrompt(
  action: AIAction,
  content: string,
  options?: Record<string, unknown>
): string {
  switch (action) {
    case 'rewrite':
      return `Rewrite the following content to improve clarity and engagement while preserving the original meaning and tone:

---
${content}
---

Rewritten version:`

    case 'expand':
      return `Expand the following content by adding more detail, examples, and context. Make it more comprehensive while maintaining the core message:

---
${content}
---

Expanded version:`

    case 'summarize':
      return `Summarize the following content into a concise version that captures the key points:

---
${content}
---

Summary:`

    case 'simplify':
      return `Simplify the following content to make it easier to understand. Use simpler words and shorter sentences while keeping the meaning:

---
${content}
---

Simplified version:`

    case 'change_tone': {
      const tone = options?.tone || 'professional'
      return `Rewrite the following content in a ${tone} tone while preserving the core message:

---
${content}
---

Rewritten in ${tone} tone:`
    }

    case 'translate': {
      const language = options?.languageName || 'Spanish'
      return `Translate the following content to ${language}. Maintain the tone and meaning:

---
${content}
---

${language} translation:`
    }

    case 'repurpose': {
      const targetType = String(options?.targetType || 'social_post')
      const typeLabels: Record<string, string> = {
        email: 'a marketing email',
        social_post: 'a social media post',
        ad_creative: 'advertising copy',
        blog_post: 'a blog post',
        video_script: 'a video script',
      }
      const targetLabel = typeLabels[targetType] || 'different format'
      
      return `Convert the following content into ${targetLabel}. Adapt the format and style appropriately:

---
${content}
---

Repurposed as ${targetLabel}:`
    }

    default:
      return content
  }
}

/**
 * Bulk action on multiple content items
 */
export async function executeBulkAIAction(
  items: Array<{ id: string; content: string }>,
  action: AIAction,
  options?: Record<string, unknown> & { workspaceId?: string }
): Promise<Array<{ id: string; success: boolean; output?: string; error?: string }>> {
  const results = await Promise.all(
    items.map(async (item) => {
      const result = await executeAIAction({
        content: item.content,
        action,
        options,
        workspaceId: options?.workspaceId,
      })
      return {
        id: item.id,
        ...result,
      }
    })
  )

  return results
}

/**
 * Detect bulk operation intent from chat message
 */
export function detectBulkIntent(message: string): {
  isBulk: boolean
  action?: AIAction
  scope?: 'all' | 'selected' | 'type'
  targetType?: string
} {
  const lowered = message.toLowerCase()

  // Check for bulk indicators
  const bulkIndicators = ['all', 'every', 'each', 'bulk', 'batch', 'multiple']
  const isBulk = bulkIndicators.some((ind) => lowered.includes(ind))

  if (!isBulk) {
    return { isBulk: false }
  }

  // Detect action
  let action: AIAction | undefined
  if (lowered.includes('rewrite') || lowered.includes('rephrase')) {
    action = 'rewrite'
  } else if (lowered.includes('expand') || lowered.includes('longer')) {
    action = 'expand'
  } else if (lowered.includes('summar') || lowered.includes('shorter')) {
    action = 'summarize'
  } else if (lowered.includes('translat')) {
    action = 'translate'
  } else if (lowered.includes('tone') || lowered.includes('make it')) {
    action = 'change_tone'
  } else if (lowered.includes('simplif') || lowered.includes('easier')) {
    action = 'simplify'
  }

  // Detect scope
  let scope: 'all' | 'selected' | 'type' = 'all'
  if (lowered.includes('selected')) {
    scope = 'selected'
  } else if (
    lowered.includes('email') ||
    lowered.includes('social') ||
    lowered.includes('landing') ||
    lowered.includes('ad')
  ) {
    scope = 'type'
  }

  // Detect target type if scope is type
  let targetType: string | undefined
  if (scope === 'type') {
    if (lowered.includes('email')) targetType = 'email'
    else if (lowered.includes('social')) targetType = 'social_post'
    else if (lowered.includes('landing')) targetType = 'landing_page'
    else if (lowered.includes('ad')) targetType = 'ad_creative'
  }

  return { isBulk: true, action, scope, targetType }
}
