/**
 * Canvas Bulk Operations
 * 
 * Apply AI-generated changes to multiple assets at once.
 */

import { createServiceClient } from '@/lib/supabase/service'
import { generateText } from '@/lib/ai/langsmith-ai'
import { MODELS } from '@/lib/ai/ai-sdk-client'

export interface BulkUpdateOperation {
  type: 'rewrite' | 'translate' | 'tone_change' | 'expand' | 'condense' | 'custom'
  prompt: string
  targetField?: string // e.g., 'content.headline', 'content.body'
}

export interface BulkUpdateResult {
  assetId: string
  assetName: string
  success: boolean
  originalValue?: string
  newValue?: string
  error?: string
}

export interface BulkUpdateInput {
  workspaceId: string
  projectId: string
  assetIds: string[]
  operation: BulkUpdateOperation
}

/**
 * Apply a bulk update operation to multiple assets
 */
export async function applyBulkUpdate(
  input: BulkUpdateInput
): Promise<{ results: BulkUpdateResult[]; summary: string }> {
  const supabase = createServiceClient()

  // Fetch all target assets
  const { data: assets, error: fetchError } = await supabase
    .from('project_assets')
    .select('*')
    .eq('project_id', input.projectId)
    .in('id', input.assetIds)

  if (fetchError) throw fetchError
  if (!assets || assets.length === 0) {
    return { results: [], summary: 'No assets found' }
  }

  const results: BulkUpdateResult[] = []

  // Process each asset
  for (const asset of assets) {
    try {
      const result = await processAssetUpdate(asset, input.operation)
      results.push({
        assetId: asset.id,
        assetName: asset.name,
        success: true,
        originalValue: result.originalValue,
        newValue: result.newValue,
      })

      // Update the asset in the database
      const updateData = buildUpdateData(asset, input.operation.targetField, result.newValue)
      await supabase
        .from('project_assets')
        .update(updateData)
        .eq('id', asset.id)
    } catch (error) {
      results.push({
        assetId: asset.id,
        assetName: asset.name,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  const successCount = results.filter((r) => r.success).length
  const summary = `Updated ${successCount} of ${results.length} assets`

  return { results, summary }
}

/**
 * Process a single asset update
 */
async function processAssetUpdate(
  asset: Record<string, unknown>,
  operation: BulkUpdateOperation
): Promise<{ originalValue: string; newValue: string }> {
  const content = asset.content as Record<string, unknown> | null

  // Get the target value to transform
  let originalValue = ''
  if (operation.targetField) {
    const fields = operation.targetField.split('.')
    let value: unknown = asset
    for (const field of fields) {
      value = (value as Record<string, unknown>)?.[field]
    }
    originalValue = String(value || '')
  } else {
    // Default to headline + subheadline for general operations
    originalValue = [
      content?.headline,
      content?.subheadline,
      content?.body,
    ]
      .filter(Boolean)
      .join('\n\n')
  }

  if (!originalValue.trim()) {
    throw new Error('No content to transform')
  }

  // Generate the transformation
  const systemPrompt = getSystemPromptForOperation(operation)
  
  const { text } = await generateText({
    model: MODELS.FAST,
    system: systemPrompt,
    prompt: `Original content:\n${originalValue}\n\nUser instruction: ${operation.prompt}`,
    maxOutputTokens: 1000,
  })

  return {
    originalValue,
    newValue: text.trim(),
  }
}

/**
 * Get system prompt based on operation type
 */
function getSystemPromptForOperation(operation: BulkUpdateOperation): string {
  switch (operation.type) {
    case 'rewrite':
      return `You are a marketing copywriter. Rewrite the given content while preserving its core message. 
Output ONLY the rewritten content, no explanations.`

    case 'translate':
      return `You are a professional translator for marketing content. 
Translate the content while preserving marketing impact and cultural nuance.
Output ONLY the translated content, no explanations.`

    case 'tone_change':
      return `You are a marketing copywriter. Adjust the tone of the content as instructed while preserving the core message.
Output ONLY the modified content, no explanations.`

    case 'expand':
      return `You are a marketing copywriter. Expand the content with more detail and supporting points.
Output ONLY the expanded content, no explanations.`

    case 'condense':
      return `You are a marketing copywriter. Condense the content to be more concise while keeping key points.
Output ONLY the condensed content, no explanations.`

    case 'custom':
    default:
      return `You are a marketing copywriter. Apply the requested transformation to the content.
Output ONLY the transformed content, no explanations.`
  }
}

/**
 * Build update data for the database
 */
function buildUpdateData(
  asset: Record<string, unknown>,
  targetField: string | undefined,
  newValue: string
): Record<string, unknown> {
  if (!targetField) {
    // Update the main content field if no specific target
    const content = (asset.content as Record<string, unknown>) || {}
    return {
      content: {
        ...content,
        headline: newValue.split('\n\n')[0] || newValue,
      },
    }
  }

  const fields = targetField.split('.')
  if (fields[0] === 'content') {
    const content = (asset.content as Record<string, unknown>) || {}
    const fieldName = fields.slice(1).join('.')
    return {
      content: setNestedValue(content, fieldName, newValue),
    }
  }

  return { [targetField]: newValue }
}

/**
 * Set a nested value in an object
 */
function setNestedValue(
  obj: Record<string, unknown>,
  path: string,
  value: unknown
): Record<string, unknown> {
  const result = { ...obj }
  const keys = path.split('.')
  let current: Record<string, unknown> = result

  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i]
    current[key] = { ...(current[key] as Record<string, unknown> || {}) }
    current = current[key] as Record<string, unknown>
  }

  current[keys[keys.length - 1]] = value
  return result
}

/**
 * Preview what a bulk operation would do (without applying)
 */
export async function previewBulkUpdate(
  input: BulkUpdateInput
): Promise<{ previews: Array<{ assetId: string; assetName: string; preview: string }> }> {
  const supabase = createServiceClient()

  // Fetch first 3 assets for preview
  const { data: assets, error } = await supabase
    .from('project_assets')
    .select('*')
    .eq('project_id', input.projectId)
    .in('id', input.assetIds.slice(0, 3))

  if (error) throw error
  if (!assets || assets.length === 0) {
    return { previews: [] }
  }

  const previews = await Promise.all(
    assets.map(async (asset) => {
      try {
        const result = await processAssetUpdate(asset, input.operation)
        return {
          assetId: asset.id,
          assetName: asset.name,
          preview: result.newValue,
        }
      } catch {
        return {
          assetId: asset.id,
          assetName: asset.name,
          preview: '[Unable to generate preview]',
        }
      }
    })
  )

  return { previews }
}

/**
 * Get suggested bulk operations based on selected assets
 */
export function getSuggestedOperations(assetCount: number): BulkUpdateOperation[] {
  return [
    {
      type: 'rewrite',
      prompt: 'Rewrite to be more engaging and action-oriented',
    },
    {
      type: 'tone_change',
      prompt: 'Make the tone more professional and formal',
    },
    {
      type: 'tone_change',
      prompt: 'Make the tone more casual and friendly',
    },
    {
      type: 'condense',
      prompt: 'Shorten by 30% while keeping key points',
    },
    {
      type: 'expand',
      prompt: 'Add more detail and supporting examples',
    },
  ]
}
