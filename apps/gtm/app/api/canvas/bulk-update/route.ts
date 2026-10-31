/**
 * Canvas Bulk Update API
 * 
 * Apply AI-powered bulk updates to multiple canvas assets.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { applyBulkUpdate, previewBulkUpdate, BulkUpdateOperation } from '@/lib/canvas/bulk-operations'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { projectId, assetIds, operation, preview } = body as {
      projectId: string
      assetIds: string[]
      operation: BulkUpdateOperation
      preview?: boolean
    }

    if (!projectId || !assetIds || assetIds.length === 0 || !operation) {
      return NextResponse.json(
        { error: 'Missing required fields: projectId, assetIds, operation' },
        { status: 400 }
      )
    }

    // Get workspace ID for the project
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('workspace_id')
      .eq('id', projectId)
      .single()

    if (projectError || !project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      )
    }

    // Verify user has access to this workspace
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', project.workspace_id)
      .eq('user_id', user.id)
      .single()

    if (!membership) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      )
    }

    const input = {
      workspaceId: project.workspace_id,
      projectId,
      assetIds,
      operation,
    }

    if (preview) {
      // Return preview without applying changes
      const { previews } = await previewBulkUpdate(input)
      return NextResponse.json({ previews })
    }

    // Apply the bulk update
    const { results, summary } = await applyBulkUpdate(input)

    return NextResponse.json({ results, summary })
  } catch (error) {
    console.error('POST /api/canvas/bulk-update error:', error)
    return NextResponse.json(
      { error: 'Failed to apply bulk update' },
      { status: 500 }
    )
  }
}
