/**
 * Dev-only API to bypass onboarding for testing.
 * Only works when NODE_ENV=development or BYPASS_ONBOARDING=true.
 * Creates a new workspace and adds the user (avoids default workspace issues).
 */

import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function POST() {
  const isDev =
    process.env.NODE_ENV === 'development' ||
    process.env.BYPASS_ONBOARDING === 'true'

  if (!isDev) {
    return NextResponse.json(
      { error: 'Bypass only available in development' },
      { status: 403 }
    )
  }

  try {
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const serviceClient = createServiceClient()

    // Check for existing membership - use maybeSingle() to avoid errors
    const { data: existingMembership } = await serviceClient
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (existingMembership) {
      // User already has a workspace - just mark onboarding complete
      const { data: ws } = await serviceClient
        .from('workspaces')
        .select('settings')
        .eq('id', existingMembership.workspace_id)
        .single()

      const current = (ws?.settings as Record<string, unknown>) || {}
      await serviceClient
        .from('workspaces')
        .update({
          settings: { ...current, onboarding_completed: true, onboarding_completed_at: new Date().toISOString() },
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingMembership.workspace_id)

      return NextResponse.json({ success: true, message: 'Onboarding bypassed', redirectTo: '/dashboard' })
    }

    // Create a fresh workspace (avoids default workspace / RLS issues)
    const slug = 'dev-bypass-' + Date.now().toString(36)
    const { data: workspace, error: workspaceError } = await serviceClient
      .from('workspaces')
      .insert({
        name: 'Dev Workspace',
        slug,
        settings: {
          onboarding_completed: true,
          onboarding_completed_at: new Date().toISOString(),
        },
      })
      .select()
      .single()

    if (workspaceError) {
      console.error('Bypass: failed to create workspace', workspaceError)
      return NextResponse.json(
        { error: 'Failed to create workspace', details: workspaceError.message },
        { status: 500 }
      )
    }

    // Add user as admin (role must be admin/reviewer/member per DB constraint)
    const { error: memberError } = await serviceClient
      .from('workspace_members')
      .insert({
        user_id: user.id,
        workspace_id: workspace.id,
        role: 'admin',
      })

    if (memberError) {
      console.error('Bypass: failed to add membership', memberError)
      await serviceClient.from('workspaces').delete().eq('id', workspace.id)
      return NextResponse.json(
        { error: 'Failed to add workspace membership', details: memberError.message },
        { status: 500 }
      )
    }

    // Create default workspace_settings
    await serviceClient.from('workspace_settings').insert({
      workspace_id: workspace.id,
      forbidden_phrases: ['guaranteed', 'risk-free', '100% safe'],
    })
    // Ignore error - non-fatal

    return NextResponse.json({
      success: true,
      message: 'Onboarding bypassed',
      redirectTo: '/dashboard',
    })
  } catch (error) {
    console.error('Onboarding bypass error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
