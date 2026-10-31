import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { executeAIAction, executeBulkAIAction, AIAction } from '@/lib/ai/ai-actions'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's workspace
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .single()

    if (!membership) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 404 })
    }

    const body = await request.json()
    const { action, content, items, options, projectId, brandId, audienceId } = body

    if (!action) {
      return NextResponse.json({ error: 'Action is required' }, { status: 400 })
    }

    // Bulk action
    if (items && Array.isArray(items)) {
      const results = await executeBulkAIAction(
        items,
        action as AIAction,
        {
          ...options,
          workspaceId: membership.workspace_id,
        }
      )
      return NextResponse.json({ success: true, results })
    }

    // Single action
    if (!content) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 })
    }

    const result = await executeAIAction({
      content,
      action: action as AIAction,
      options,
      workspaceId: membership.workspace_id,
      projectId,
      brandId,
      audienceId,
    })

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 })
    }

    return NextResponse.json({ success: true, output: result.output })
  } catch (error) {
    console.error('POST /api/ai/actions error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
