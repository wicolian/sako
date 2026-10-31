import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient as createClient } from '@/lib/supabase/server'
import { getWorkspaceContext } from '@/lib/workspace'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { userId, workspaceId } = await getWorkspaceContext(request)
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const data = await request.json()
    const {
      workspaceName,
      industry,
      primaryGoal,
      connectedProviders,
      policyTemplateId,
    } = data

    // Update workspace with onboarding data
    const { error: workspaceError } = await supabase
      .from('workspaces')
      .update({
        name: workspaceName,
        settings: {
          industry,
          primaryGoal,
          selectedProviders: connectedProviders || [],
          defaultPolicyTemplate: policyTemplateId || 'default',
          onboarding_completed: true,
          onboarding_completed_at: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', workspaceId)

    if (workspaceError) {
      console.error('Failed to update workspace:', workspaceError)
      return NextResponse.json(
        { error: 'Failed to save onboarding data' },
        { status: 500 }
      )
    }

    // Apply the selected policy template if specified
    if (policyTemplateId && policyTemplateId !== 'default') {
      try {
        await fetch(`${request.nextUrl.origin}/api/policies/templates`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-workspace-id': workspaceId,
          },
          body: JSON.stringify({ templateId: policyTemplateId }),
        })
      } catch (error) {
        console.warn('Failed to apply policy template:', error)
        // Non-critical error, continue
      }
    }

    // Mark user's onboarding as complete
    const { error: userError } = await supabase
      .from('workspace_members')
      .update({
        metadata: {
          onboarding_completed: true,
        },
      })
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId)

    if (userError) {
      console.warn('Failed to update user onboarding status:', userError)
    }

    return NextResponse.json({
      success: true,
      message: 'Onboarding completed successfully',
      data: {
        workspaceId,
        workspaceName,
        industry,
        primaryGoal,
      },
    })
  } catch (error) {
    console.error('Onboarding error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { workspaceId } = await getWorkspaceContext(request)

    // Check if onboarding is complete
    const { data: workspace } = await supabase
      .from('workspaces')
      .select('settings')
      .eq('id', workspaceId)
      .single()

    const onboardingCompleted = workspace?.settings?.onboarding_completed === true

    return NextResponse.json({
      completed: onboardingCompleted,
      settings: workspace?.settings || {},
    })
  } catch (error) {
    console.error('Error checking onboarding status:', error)
    return NextResponse.json(
      { completed: false, error: 'Failed to check status' },
      { status: 500 }
    )
  }
}
