import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getWorkspaceId } from '@/lib/workspace'

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const db = createServiceClient()
    
    // Try to get workspace from header, or from db
    let workspaceId: string
    try {
      workspaceId = getWorkspaceId(request)
    } catch {
      // Get from membership
      const { data: membership } = await db
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_id', userId)
        .single()
      
      if (!membership) {
        return NextResponse.json({ error: 'No workspace found' }, { status: 404 })
      }
      workspaceId = membership.workspace_id
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
    const settings = {
      industry,
      primaryGoal,
      selectedProviders: connectedProviders || [],
      defaultPolicyTemplate: policyTemplateId || 'default',
      onboarding_completed: true,
      onboarding_completed_at: new Date().toISOString(),
    }

    const { error: workspaceError } = await db
      .from('workspaces')
      .update({
        name: workspaceName,
        settings: JSON.stringify(settings),
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
    const { error: userError } = await db
      .from('workspace_members')
      .update({
        metadata: JSON.stringify({
          onboarding_completed: true,
        }),
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
    const { userId } = await auth()
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const db = createServiceClient()
    
    // Get workspace from membership
    const { data: membership } = await db
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', userId)
      .single()
    
    if (!membership) {
      return NextResponse.json({
        completed: false,
        settings: {},
      })
    }

    // Check if onboarding is complete
    const { data: workspace } = await db
      .from('workspaces')
      .select('settings')
      .eq('id', membership.workspace_id)
      .single()

    // Parse settings if it's a string
    const settings = typeof workspace?.settings === 'string' 
      ? JSON.parse(workspace.settings) 
      : workspace?.settings

    const onboardingCompleted = settings?.onboarding_completed === true

    return NextResponse.json({
      completed: onboardingCompleted,
      settings: settings || {},
    })
  } catch (error) {
    console.error('Error checking onboarding status:', error)
    return NextResponse.json(
      { completed: false, error: 'Failed to check status' },
      { status: 500 }
    )
  }
}
