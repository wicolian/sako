/**
 * Studio App Runner
 * 
 * Executes Studio apps with context resolution and AI generation.
 */

import { generateText } from '@/lib/ai/langsmith-ai'
import { createServiceClient } from '@/lib/supabase/service'
import { MODELS } from '@/lib/ai/ai-sdk-client'
import { getBrandContext, formatBrandPrompt } from '@/lib/ai/brand-context'
import { getAudienceById, formatAudienceForPrompt } from '@/lib/audiences/audience-manager'
import { StudioApp, AppRun, RunAppInput } from './types'
import { getApp, resolveInstructions, validateInputs } from './app-engine'

interface RunResult {
  success: boolean
  output?: string
  error?: string
  run?: AppRun
  tokensUsed?: number
  latencyMs?: number
}

/**
 * Run a Studio app with the provided inputs
 */
export async function runApp(
  appId: string,
  userId: string,
  input: RunAppInput
): Promise<RunResult> {
  const supabase = createServiceClient()
  const startTime = Date.now()

  // Get the app
  const app = await getApp(appId)
  if (!app) {
    return { success: false, error: 'App not found' }
  }

  // Validate inputs
  const validation = validateInputs(input.inputs, app.inputs)
  if (!validation.valid) {
    return { success: false, error: validation.errors.join(', ') }
  }

  // Create run record
  const { data: run, error: runError } = await supabase
    .from('studio_app_runs')
    .insert({
      app_id: appId,
      user_id: userId,
      inputs: input.inputs,
      model: app.model,
      status: 'running',
      brand_id: input.brand_id || app.default_brand_id,
      audience_id: input.audience_id || app.default_audience_id,
      knowledge_items: input.knowledge_ids || app.knowledge_items,
    })
    .select()
    .single()

  if (runError) {
    console.error('Failed to create run record:', runError)
    return { success: false, error: 'Failed to start app run' }
  }

  try {
    // Build context
    const context = await buildContext(app, input)

    // Resolve instructions with inputs and context
    const resolvedInstructions = resolveInstructions(
      app.instructions,
      input.inputs,
      context
    )

    // Build the system prompt
    const systemPrompt = buildSystemPrompt(app, context)

    // Get the model
    const model = getModelForApp(app.model)

    // Generate output
    const result = await generateText({
      model,
      system: systemPrompt,
      prompt: resolvedInstructions,
      temperature: app.temperature,
      ...(app.max_tokens && { maxOutputTokens: app.max_tokens }),
    })

    const latencyMs = Date.now() - startTime
    const tokensUsed = result.usage?.totalTokens || 0

    // Update run record with success
    await supabase
      .from('studio_app_runs')
      .update({
        output: result.text,
        status: 'completed',
        tokens_used: tokensUsed,
        latency_ms: latencyMs,
      })
      .eq('id', run.id)

    return {
      success: true,
      output: result.text,
      run: { ...run, output: result.text, status: 'completed' } as AppRun,
      tokensUsed,
      latencyMs,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    // Update run record with failure
    await supabase
      .from('studio_app_runs')
      .update({
        status: 'failed',
        error_message: errorMessage,
        latency_ms: Date.now() - startTime,
      })
      .eq('id', run.id)

    console.error('App run failed:', error)
    return { success: false, error: errorMessage }
  }
}

/**
 * Build context for app execution
 */
async function buildContext(
  app: StudioApp,
  input: RunAppInput
): Promise<{
  brandVoice?: string
  audienceInfo?: string
  knowledgeItems?: Array<{ title: string; content: string }>
}> {
  const supabase = createServiceClient()
  const context: {
    brandVoice?: string
    audienceInfo?: string
    knowledgeItems?: Array<{ title: string; content: string }>
  } = {}

  // Get brand context
  const brandId = input.brand_id || app.default_brand_id
  if (brandId) {
    const brand = await getBrandContext(app.workspace_id, brandId)
    if (brand) {
      context.brandVoice = formatBrandPrompt(brand)
    }
  }

  // Get audience context
  const audienceId = input.audience_id || app.default_audience_id
  if (audienceId) {
    const audience = await getAudienceById(audienceId)
    if (audience) {
      context.audienceInfo = formatAudienceForPrompt(audience)
    }
  }

  // Get knowledge items
  const knowledgeIds = input.knowledge_ids || app.knowledge_items
  if (knowledgeIds && knowledgeIds.length > 0) {
    const { data: items } = await supabase
      .from('knowledge_items')
      .select('title, content')
      .in('id', knowledgeIds)

    if (items) {
      context.knowledgeItems = items.map((item) => ({
        title: item.title,
        content: item.content,
      }))
    }
  }

  return context
}

/**
 * Build system prompt for the app
 */
function buildSystemPrompt(
  app: StudioApp,
  context: {
    brandVoice?: string
    audienceInfo?: string
    knowledgeItems?: Array<{ title: string; content: string }>
  }
): string {
  const parts: string[] = []

  parts.push(`You are an AI assistant helping with ${app.category} content creation.`)
  parts.push(`App: ${app.name}`)
  if (app.description) {
    parts.push(`Purpose: ${app.description}`)
  }

  // Add brand context
  if (context.brandVoice) {
    parts.push('')
    parts.push('=== BRAND CONTEXT ===')
    parts.push(context.brandVoice)
  }

  // Add audience context
  if (context.audienceInfo) {
    parts.push('')
    parts.push('=== TARGET AUDIENCE ===')
    parts.push(context.audienceInfo)
  }

  // Add knowledge context
  if (context.knowledgeItems && context.knowledgeItems.length > 0) {
    parts.push('')
    parts.push('=== REFERENCE KNOWLEDGE ===')
    for (const item of context.knowledgeItems) {
      parts.push(`[${item.title}]`)
      parts.push(item.content)
      parts.push('')
    }
  }

  // Add example output if provided
  if (app.example_output) {
    parts.push('')
    parts.push('=== EXAMPLE OUTPUT FORMAT ===')
    parts.push(app.example_output)
  }

  return parts.join('\n')
}

/**
 * Get the AI model for the app
 */
function getModelForApp(modelId: string) {
  // Map model IDs to our MODELS config
  if (modelId.includes('gpt-5.4') || modelId.includes('gpt-5.3') || modelId.includes('gpt-5.2')) {
    return MODELS.BALANCED
  }
  if (modelId.includes('claude-opus')) {
    return MODELS.REASONING
  }
  if (modelId.includes('claude-sonnet')) {
    return MODELS.CREATIVE
  }
  if (modelId.includes('gemini-3.1-pro')) {
    return MODELS.BALANCED
  }

  // Default
  return MODELS.BALANCED
}

/**
 * Get suggested inputs based on app category
 */
export function getSuggestedInputs(category: string): Array<{
  name: string
  label: string
  type: string
  required: boolean
  placeholder?: string
}> {
  switch (category) {
    case 'email':
      return [
        { name: 'subject', label: 'Subject Line', type: 'short_answer', required: true, placeholder: 'e.g., Exciting news about...' },
        { name: 'recipient_type', label: 'Recipient Type', type: 'dropdown', required: true },
        { name: 'email_purpose', label: 'Email Purpose', type: 'paragraph', required: true, placeholder: 'What is the goal of this email?' },
        { name: 'tone', label: 'Tone', type: 'dropdown', required: false },
      ]
    case 'social':
      return [
        { name: 'platform', label: 'Platform', type: 'dropdown', required: true },
        { name: 'content_type', label: 'Content Type', type: 'dropdown', required: true },
        { name: 'topic', label: 'Topic/Message', type: 'paragraph', required: true, placeholder: 'What do you want to communicate?' },
        { name: 'hashtags', label: 'Include Hashtags', type: 'checkboxes', required: false },
      ]
    case 'ads':
      return [
        { name: 'ad_platform', label: 'Ad Platform', type: 'dropdown', required: true },
        { name: 'product_service', label: 'Product/Service', type: 'short_answer', required: true },
        { name: 'value_proposition', label: 'Value Proposition', type: 'paragraph', required: true },
        { name: 'call_to_action', label: 'Call to Action', type: 'short_answer', required: true },
      ]
    case 'content':
      return [
        { name: 'content_type', label: 'Content Type', type: 'dropdown', required: true },
        { name: 'topic', label: 'Topic', type: 'short_answer', required: true },
        { name: 'key_points', label: 'Key Points', type: 'tags', required: false },
        { name: 'word_count', label: 'Target Word Count', type: 'short_answer', required: false },
      ]
    default:
      return [
        { name: 'input', label: 'Input', type: 'paragraph', required: true, placeholder: 'Enter your input...' },
      ]
  }
}
