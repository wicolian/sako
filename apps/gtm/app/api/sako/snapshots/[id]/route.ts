/**
 * Composer Snapshot API Route
 *
 * GET /api/sako/snapshots/[id] - Get snapshot metadata or full content
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getWorkspaceContext } from '@/lib/workspace'

interface SnapshotResponse {
  id: string
  campaignId: string
  versionNumber: number
  versionLabel?: string
  assetType: string
  htmlContent?: string
  jsonContent?: unknown
  metadata?: unknown
  createdAt: string
  createdBy?: string
  renderUrl: string
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<SnapshotResponse | { error: string }>> {
  const supabase = createServiceClient()

  try {
    const { workspaceId } = getWorkspaceContext(request)
    const { id } = await params

    const { data: snapshot, error } = await supabase
      .from('composer_snapshots')
      .select('*')
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .single()

    if (error || !snapshot) {
      return NextResponse.json({ error: 'Snapshot not found' }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const includeContent = searchParams.get('includeContent') === 'true'

    return NextResponse.json({
      id: snapshot.id,
      campaignId: snapshot.campaign_id,
      versionNumber: snapshot.version_number,
      versionLabel: snapshot.version_label,
      assetType: snapshot.asset_type,
      htmlContent: includeContent ? snapshot.html_content : undefined,
      jsonContent: includeContent ? snapshot.json_content : undefined,
      metadata: snapshot.metadata,
      createdAt: snapshot.created_at,
      createdBy: snapshot.created_by,
      renderUrl: `/api/sako/snapshots/${snapshot.id}/render`,
    })
  } catch (error) {
    console.error('Snapshot fetch error:', error)

    if (error instanceof Error && error.name === 'WorkspaceError') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    return NextResponse.json({ error: 'Failed to fetch snapshot' }, { status: 500 })
  }
}
