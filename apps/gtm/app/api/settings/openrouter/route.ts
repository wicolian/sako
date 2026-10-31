/**
 * OpenRouter Settings API (Feb 2026)
 *
 * GET /api/settings/openrouter - Get workspace OpenRouter settings
 * PATCH /api/settings/openrouter - Update workspace OpenRouter settings
 *
 * Settings are stored in workspaces.settings.openrouter JSON field.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/workspace'
import type { WorkspaceOpenRouterSettings } from '@/lib/ai/context'

interface WorkspaceSettings {
  openrouter?: WorkspaceOpenRouterSettings
  [key: string]: unknown
}

const DEFAULT_OPENROUTER_SETTINGS: WorkspaceOpenRouterSettings = {
  routing: {
    allow_fallbacks: true,
    require_parameters: true,
    data_collection: 'deny',
  },
  plugins: {
    responseHealing: true,
    web: false,
    fileParser: false,
    moderation: false,
    autoRouter: false,
  },
  modelPolicy: {
    dynamicLatest2026: true,
  },
}

export async function GET(request: Request) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const workspaceId = getWorkspaceId(request)
  if (!workspaceId) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
  }

  // Get workspace settings
  const { data: workspace, error: fetchError } = await supabase
    .from('workspaces')
    .select('settings')
    .eq('id', workspaceId)
    .single()

  if (fetchError || !workspace) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
  }

  const settings = workspace.settings as WorkspaceSettings | null
  const openrouterSettings = settings?.openrouter ?? DEFAULT_OPENROUTER_SETTINGS

  return NextResponse.json({
    settings: openrouterSettings,
    defaults: DEFAULT_OPENROUTER_SETTINGS,
  })
}

export async function PATCH(request: Request) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const workspaceId = getWorkspaceId(request)
  if (!workspaceId) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
  }

  try {
    // Get current workspace settings
    const { data: workspace, error: fetchError } = await supabase
      .from('workspaces')
      .select('settings')
      .eq('id', workspaceId)
      .single()

    if (fetchError || !workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
    }

    // Parse request body
    const body = await request.json()
    const updates: Partial<WorkspaceOpenRouterSettings> = body

    // Validate updates
    if (updates.systemPrompt !== undefined && typeof updates.systemPrompt !== 'string') {
      return NextResponse.json({ error: 'systemPrompt must be a string' }, { status: 400 })
    }

    // Merge with existing settings
    const currentSettings = workspace.settings as WorkspaceSettings | null
    const currentOpenRouter = currentSettings?.openrouter ?? DEFAULT_OPENROUTER_SETTINGS

    const updatedOpenRouter: WorkspaceOpenRouterSettings = {
      systemPrompt: updates.systemPrompt ?? currentOpenRouter.systemPrompt,
      routing: {
        ...currentOpenRouter.routing,
        ...updates.routing,
      },
      plugins: {
        ...currentOpenRouter.plugins,
        ...updates.plugins,
      },
      modelPolicy: {
        ...currentOpenRouter.modelPolicy,
        ...updates.modelPolicy,
      },
    }

    // Update workspace settings
    const { error: updateError } = await supabase
      .from('workspaces')
      .update({
        settings: {
          ...currentSettings,
          openrouter: updatedOpenRouter,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', workspaceId)

    if (updateError) {
      console.error('Error updating OpenRouter settings:', updateError)
      return NextResponse.json(
        { error: 'Failed to update settings' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      settings: updatedOpenRouter,
    })
  } catch (error) {
    console.error('Error updating OpenRouter settings:', error)
    return NextResponse.json(
      { error: 'Failed to update settings' },
      { status: 500 }
    )
  }
}
