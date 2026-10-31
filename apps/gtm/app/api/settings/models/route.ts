/**
 * Model Preferences API
 *
 * GET  /api/settings/models — returns current preferences + available models catalog
 * PATCH /api/settings/models — updates workspace model preferences (validates model IDs)
 *
 * Preferences stored in workspaces.settings.openrouter.modelPreferences JSONB.
 * No migration needed — piggybacks on existing workspaces.settings column.
 */
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/workspace'
import { z } from 'zod'
import {
  AVAILABLE_MODELS,
  isValidModelForTier,
  type ModelPreferences,
  type UserControllableTier,
} from '@/lib/ai/openrouter'

const ModelPreferencesSchema = z.object({
  fast: z.string().optional(),
  balanced: z.string().optional(),
  creative: z.string().optional(),
  reasoning: z.string().optional(),
  structured: z.string().optional(),
})

export async function GET(request: Request): Promise<NextResponse> {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const workspaceId = getWorkspaceId(request)
  if (!workspaceId) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
  }

  const { data: workspace, error } = await supabase
    .from('workspaces')
    .select('settings')
    .eq('id', workspaceId)
    .single()

  if (error || !workspace) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
  }

  const settings = workspace.settings as Record<string, unknown> | null
  const openrouterSettings = settings?.openrouter as Record<string, unknown> | undefined
  const preferences = (openrouterSettings?.modelPreferences ?? {}) as ModelPreferences

  return NextResponse.json({ preferences, availableModels: AVAILABLE_MODELS })
}

export async function PATCH(request: Request): Promise<NextResponse> {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const workspaceId = getWorkspaceId(request)
  if (!workspaceId) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = ModelPreferencesSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request body', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const preferences = parsed.data

  // Validate each model ID against its tier
  for (const [tier, modelId] of Object.entries(preferences)) {
    if (!modelId) continue
    if (!isValidModelForTier(modelId, tier as UserControllableTier)) {
      return NextResponse.json(
        { error: `Invalid model "${modelId}" for tier "${tier}"` },
        { status: 400 },
      )
    }
  }

  // Get current workspace settings to merge
  const { data: workspace, error: fetchError } = await supabase
    .from('workspaces')
    .select('settings')
    .eq('id', workspaceId)
    .single()

  if (fetchError || !workspace) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
  }

  const currentSettings = workspace.settings as Record<string, unknown> | null
  const currentOpenRouter = (currentSettings?.openrouter ?? {}) as Record<string, unknown>

  const { error: updateError } = await supabase
    .from('workspaces')
    .update({
      settings: {
        ...currentSettings,
        openrouter: {
          ...currentOpenRouter,
          modelPreferences: preferences,
        },
      },
      updated_at: new Date().toISOString(),
    })
    .eq('id', workspaceId)

  if (updateError) {
    console.error('Error updating model preferences:', updateError)
    return NextResponse.json({ error: 'Failed to update preferences' }, { status: 500 })
  }

  return NextResponse.json({ success: true, preferences })
}
