import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getWorkspaceContext } from '@/lib/workspace'

interface ComposerSnapshotResponse {
  taskId: string
  source: 'task_composer_snapshots' | 'composer_snapshots'
  snapshotId?: string
  documentId?: string | null
  versionId?: string | null
  versionLabel?: string | null
  assetType?: string | null
  createdAt?: string
  html?: string | null
  json?: Record<string, unknown> | null
  metadata?: Record<string, unknown> | null
  renderUrl: string
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ComposerSnapshotResponse | { error: string }>> {
  const supabase = createServiceClient()

  try {
    const { workspaceId } = getWorkspaceContext(request)
    const { id: taskId } = await params

    const { data: task, error: taskError } = await supabase
      .from('sako_tasks')
      .select('id, workspace_id, snapshot_id')
      .eq('id', taskId)
      .single()

    if (taskError || !task || task.workspace_id !== workspaceId) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    const { data: taskSnapshot } = await supabase
      .from('task_composer_snapshots')
      .select('*')
      .eq('task_id', taskId)
      .eq('workspace_id', workspaceId)
      .maybeSingle()

    if (taskSnapshot) {
      return NextResponse.json({
        taskId,
        source: 'task_composer_snapshots',
        snapshotId: taskSnapshot.id,
        documentId: taskSnapshot.document_id,
        versionId: taskSnapshot.version_id,
        createdAt: taskSnapshot.created_at,
        html: taskSnapshot.html_content,
        json: taskSnapshot.json_content,
        metadata: taskSnapshot.metadata,
        renderUrl: `/api/tasks/${taskId}/composer-snapshot/render`,
      })
    }

    if (!task.snapshot_id) {
      return NextResponse.json({ error: 'No composer snapshot found for task' }, { status: 404 })
    }

    const { data: composerSnapshot, error: composerSnapshotError } = await supabase
      .from('composer_snapshots')
      .select('*')
      .eq('id', task.snapshot_id)
      .eq('workspace_id', workspaceId)
      .single()

    if (composerSnapshotError || !composerSnapshot) {
      return NextResponse.json({ error: 'Snapshot not found' }, { status: 404 })
    }

    return NextResponse.json({
      taskId,
      source: 'composer_snapshots',
      snapshotId: composerSnapshot.id,
      versionLabel: composerSnapshot.version_label,
      assetType: composerSnapshot.asset_type,
      createdAt: composerSnapshot.created_at,
      html: composerSnapshot.html_content,
      json: composerSnapshot.json_content,
      metadata: composerSnapshot.metadata,
      renderUrl: `/api/sako/snapshots/${composerSnapshot.id}/render`,
    })
  } catch (error) {
    console.error('Failed to fetch task composer snapshot:', error)

    if (error instanceof Error && error.name === 'WorkspaceError') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    return NextResponse.json({ error: 'Failed to fetch composer snapshot' }, { status: 500 })
  }
}
