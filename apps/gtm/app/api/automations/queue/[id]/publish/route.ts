/**
 * POST /api/automations/queue/[id]/publish
 *
 * Approve and publish a scheduled content item.
 * Enforces compliance gate before publishing.
 * Records provider post ID and publish timestamp.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceId, getUserId } from '@/lib/workspace'
import { createServiceClient } from '@/lib/supabase/service'
import { checkComplianceGate } from '@/lib/claims/compliance-gate'
import { publishToSocial } from '@/lib/integrations/social-publisher'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const workspaceId = getWorkspaceId(request)
  const userId = getUserId(request)
  const { id: queueItemId } = await params
  const supabase = createServiceClient()
  let queueItemIdForFailure: string | null = null

  try {
    // Fetch the scheduled content item
    const { data: item, error: fetchError } = await supabase
      .from('scheduled_content')
      .select('*, asset_documents(*)')
      .eq('id', queueItemId)
      .eq('workspace_id', workspaceId)
      .single()

    if (fetchError || !item) {
      return NextResponse.json({ error: 'Queue item not found' }, { status: 404 })
    }
    queueItemIdForFailure = queueItemId

    if (item.status === 'published') {
      return NextResponse.json({ error: 'Already published' }, { status: 409 })
    }

    if (item.status === 'rejected') {
      return NextResponse.json({ error: 'Item was rejected' }, { status: 409 })
    }

    const assetDocId = item.asset_document_id
    if (!assetDocId) {
      return NextResponse.json({ error: 'No asset document linked' }, { status: 400 })
    }

    // Compliance gate
    const blocked = await checkComplianceGate(assetDocId, workspaceId)
    if (blocked) return blocked

    // Get the asset document
    const assetDoc = item.asset_documents as Record<string, unknown> | null
    if (!assetDoc) {
      return NextResponse.json({ error: 'Asset document not found' }, { status: 404 })
    }

    // Determine platform from channel or asset type
    const channel = (assetDoc.channel as string) ?? 'linkedin'
    const content = extractTextContent(assetDoc.html as string ?? '')

    // Publish to social platform
    const publishResult = await publishToSocial({
      assetDocumentId: assetDocId,
      workspaceId,
      platform: channel as 'linkedin' | 'twitter' | 'facebook' | 'instagram',
      content,
      imageUrl: assetDoc.rendered_image_url as string | undefined,
    })

    // Update scheduled content status
    const newStatus = publishResult.status === 'published' ? 'published' : 'failed'
    await supabase
      .from('scheduled_content')
      .update({
        status: newStatus,
        approved_by: userId,
        approved_at: new Date().toISOString(),
        published_at: newStatus === 'published' ? new Date().toISOString() : null,
        metrics_json: {
          provider: channel,
          postId: publishResult.postId,
          postUrl: publishResult.postUrl,
          error: publishResult.error,
          publishedAt: new Date().toISOString(),
        },
      })
      .eq('id', queueItemId)

    // Update asset document status
    if (newStatus === 'published') {
      await supabase
        .from('asset_documents')
        .update({ status: 'published' })
        .eq('id', assetDocId)
    }

    return NextResponse.json({
      success: publishResult.status === 'published',
      status: newStatus,
      postId: publishResult.postId,
      postUrl: publishResult.postUrl,
      error: publishResult.error,
    })
  } catch (error) {
    console.error('[queue/publish] Error:', error)
    if (queueItemIdForFailure) {
      const errorMessage = error instanceof Error ? error.message : 'Publish failed'
      await supabase
        .from('scheduled_content')
        .update({
          status: 'failed',
          metrics_json: {
            error: errorMessage,
            failedAt: new Date().toISOString(),
          },
        })
        .eq('id', queueItemIdForFailure)
        .eq('workspace_id', workspaceId)
    }
    return NextResponse.json({ error: 'Publish failed' }, { status: 500 })
  }
}

function extractTextContent(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 3000)
}
