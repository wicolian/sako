/**
 * Studio App Engine
 * 
 * Core engine for managing and executing Studio apps.
 */

import { createServiceClient } from '@/lib/supabase/service'
import { StudioApp, AppInput, CreateAppInput, AppRun, RunAppInput } from './types'

/**
 * Create a new Studio app
 */
export async function createApp(
  workspaceId: string,
  userId: string,
  input: CreateAppInput
): Promise<StudioApp | null> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('studio_apps')
    .insert({
      workspace_id: workspaceId,
      name: input.name,
      description: input.description,
      icon: input.icon || '🤖',
      category: input.category || 'custom',
      inputs: input.inputs || [],
      instructions: input.instructions,
      example_output: input.example_output,
      model: input.model || 'openai/gpt-5.3-chat',
      temperature: input.temperature ?? 0.7,
      max_tokens: input.max_tokens,
      knowledge_items: input.knowledge_items || [],
      default_brand_id: input.default_brand_id,
      default_audience_id: input.default_audience_id,
      visibility: 'private',
      run_count: 0,
      created_by: userId,
    })
    .select()
    .single()

  if (error) {
    console.error('Failed to create app:', error)
    return null
  }

  return data as StudioApp
}

/**
 * Get app by ID
 */
export async function getApp(appId: string): Promise<StudioApp | null> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('studio_apps')
    .select('*')
    .eq('id', appId)
    .single()

  if (error) {
    return null
  }

  return data as StudioApp
}

/**
 * Get all apps for a workspace
 */
export async function getWorkspaceApps(
  workspaceId: string,
  options?: { visibility?: StudioApp['visibility']; category?: string }
): Promise<StudioApp[]> {
  const supabase = createServiceClient()

  let query = supabase
    .from('studio_apps')
    .select('*')
    .eq('workspace_id', workspaceId)

  if (options?.visibility) {
    query = query.eq('visibility', options.visibility)
  }
  if (options?.category) {
    query = query.eq('category', options.category)
  }

  const { data, error } = await query.order('updated_at', { ascending: false })

  if (error) {
    console.error('Failed to get apps:', error)
    return []
  }

  return data as StudioApp[]
}

/**
 * Get user's private apps
 */
export async function getUserApps(userId: string): Promise<StudioApp[]> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('studio_apps')
    .select('*')
    .eq('created_by', userId)
    .order('updated_at', { ascending: false })

  if (error) {
    console.error('Failed to get user apps:', error)
    return []
  }

  return data as StudioApp[]
}

/**
 * Update app
 */
export async function updateApp(
  appId: string,
  updates: Partial<StudioApp>
): Promise<StudioApp | null> {
  const supabase = createServiceClient()

  // Remove readonly fields
  const { id, workspace_id, created_by, created_at, run_count, last_run_at, ...validUpdates } = updates as StudioApp

  const { data, error } = await supabase
    .from('studio_apps')
    .update(validUpdates)
    .eq('id', appId)
    .select()
    .single()

  if (error) {
    console.error('Failed to update app:', error)
    return null
  }

  return data as StudioApp
}

/**
 * Delete app
 */
export async function deleteApp(appId: string): Promise<boolean> {
  const supabase = createServiceClient()

  const { error } = await supabase
    .from('studio_apps')
    .delete()
    .eq('id', appId)

  return !error
}

/**
 * Publish app to workspace
 */
export async function publishApp(appId: string): Promise<StudioApp | null> {
  return updateApp(appId, {
    visibility: 'workspace',
    published_at: new Date().toISOString(),
  })
}

/**
 * Unpublish app (make private)
 */
export async function unpublishApp(appId: string): Promise<StudioApp | null> {
  return updateApp(appId, {
    visibility: 'private',
    published_at: undefined,
  })
}

/**
 * Duplicate an app
 */
export async function duplicateApp(
  appId: string,
  userId: string
): Promise<StudioApp | null> {
  const supabase = createServiceClient()

  const original = await getApp(appId)
  if (!original) return null

  const { data, error } = await supabase
    .from('studio_apps')
    .insert({
      workspace_id: original.workspace_id,
      name: `${original.name} (Copy)`,
      description: original.description,
      icon: original.icon,
      category: original.category,
      inputs: original.inputs,
      instructions: original.instructions,
      example_output: original.example_output,
      model: original.model,
      temperature: original.temperature,
      max_tokens: original.max_tokens,
      knowledge_items: original.knowledge_items,
      default_brand_id: original.default_brand_id,
      default_audience_id: original.default_audience_id,
      visibility: 'private',
      run_count: 0,
      created_by: userId,
    })
    .select()
    .single()

  if (error) {
    console.error('Failed to duplicate app:', error)
    return null
  }

  return data as StudioApp
}

/**
 * Get app run history
 */
export async function getAppRuns(
  appId: string,
  limit: number = 50
): Promise<AppRun[]> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('studio_app_runs')
    .select('*')
    .eq('app_id', appId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Failed to get app runs:', error)
    return []
  }

  return data as AppRun[]
}

/**
 * Resolve placeholder references in instructions
 * 
 * Handles:
 * - {{input_name}} - Input field values
 * - {{brand:voice}} - Brand voice
 * - {{audience:name}} - Audience info
 * - {{kb:item_name}} - Knowledge base item
 */
export function resolveInstructions(
  instructions: string,
  inputs: Record<string, unknown>,
  context?: {
    brandVoice?: string
    audienceInfo?: string
    knowledgeItems?: Array<{ title: string; content: string }>
  }
): string {
  let resolved = instructions

  // Replace input placeholders
  for (const [key, value] of Object.entries(inputs)) {
    const placeholder = new RegExp(`\\{\\{${key}\\}\\}`, 'g')
    const stringValue = Array.isArray(value) ? value.join(', ') : String(value || '')
    resolved = resolved.replace(placeholder, stringValue)
  }

  // Replace brand voice placeholder
  if (context?.brandVoice) {
    resolved = resolved.replace(/\{\{brand:voice\}\}/g, context.brandVoice)
  }

  // Replace audience placeholder
  if (context?.audienceInfo) {
    resolved = resolved.replace(/\{\{audience:.*?\}\}/g, context.audienceInfo)
  }

  // Replace knowledge placeholders
  if (context?.knowledgeItems) {
    for (const item of context.knowledgeItems) {
      const placeholder = new RegExp(`\\{\\{kb:${item.title}\\}\\}`, 'gi')
      resolved = resolved.replace(placeholder, item.content)
    }
    // Replace generic knowledge placeholder with all items
    const allKnowledge = context.knowledgeItems
      .map((item) => `[${item.title}]\n${item.content}`)
      .join('\n\n')
    resolved = resolved.replace(/\{\{knowledge\}\}/g, allKnowledge)
  }

  return resolved
}

/**
 * Validate app inputs against schema
 */
export function validateInputs(
  inputs: Record<string, unknown>,
  schema: AppInput[]
): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  for (const field of schema) {
    const value = inputs[field.name]

    // Check required fields
    if (field.required) {
      if (value === undefined || value === null || value === '') {
        errors.push(`${field.label} is required`)
        continue
      }
      if (Array.isArray(value) && value.length === 0) {
        errors.push(`${field.label} is required`)
        continue
      }
    }

    // Type-specific validation
    if (value !== undefined && value !== null && value !== '') {
      switch (field.type) {
        case 'dropdown':
          if (field.options && !field.options.includes(String(value))) {
            errors.push(`${field.label} has invalid option`)
          }
          break
        case 'checkboxes':
          if (!Array.isArray(value)) {
            errors.push(`${field.label} must be an array`)
          } else if (field.options) {
            const invalid = value.filter((v) => !field.options!.includes(String(v)))
            if (invalid.length > 0) {
              errors.push(`${field.label} has invalid options: ${invalid.join(', ')}`)
            }
          }
          break
      }
    }
  }

  return { valid: errors.length === 0, errors }
}
