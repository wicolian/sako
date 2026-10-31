import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getWorkspaceId } from '@/lib/workspace'
import { getProvider } from '@/lib/providers/registry'
import { createServiceClient } from '@/lib/supabase/service'
import type { TextUpdate } from '@/lib/providers/types'

const SyncSchema = z.object({
  direction: z.enum(['import', 'export']),
  sourceUrl: z.string().url().optional(),
  fileKey: z.string().optional(),
  updates: z.array(
    z.object({
      nodeId: z.string(),
      text: z.string(),
      layerName: z.string().optional(),
    })
  ).optional(),
  assetDocumentId: z.string().uuid().optional(),
})

export async function POST(request: NextRequest) {
  const workspaceId = getWorkspaceId(request)
  if (!workspaceId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const input = SyncSchema.parse(body)

    const figma = getProvider('figma')
    const connected = await figma.isConnected(workspaceId)
    if (!connected) {
      return NextResponse.json(
        { error: 'Figma not connected for this workspace' },
        { status: 400 }
      )
    }

    if (input.direction === 'import') {
      if (!input.sourceUrl || !figma.importContent) {
        return NextResponse.json({ error: 'sourceUrl is required for import sync' }, { status: 400 })
      }

      const imported = await figma.importContent(input.sourceUrl)
      if (!imported) {
        return NextResponse.json({ error: 'Failed to import content from Figma' }, { status: 502 })
      }

      if (input.assetDocumentId) {
        const supabase = createServiceClient()
        await supabase.from('design_quality_events').insert({
          workspace_id: workspaceId,
          asset_document_id: input.assetDocumentId,
          event_type: 'edited',
          edit_diff: {
            source: 'figma_sync_import',
            importedClaims: imported.claims.length,
            importedAssets: imported.assets?.length ?? 0,
          },
        })
      }

      return NextResponse.json({
        success: true,
        direction: 'import',
        imported,
      })
    }

    if (!input.fileKey || !figma.pushContent) {
      return NextResponse.json({ error: 'fileKey is required for export sync' }, { status: 400 })
    }

    let updates: TextUpdate[] = input.updates ?? []
    if (updates.length === 0 && input.assetDocumentId) {
      updates = await buildUpdatesFromAsset(input.assetDocumentId, workspaceId)
    }
    if (updates.length === 0) {
      return NextResponse.json({ error: 'No text updates provided for export sync' }, { status: 400 })
    }

    const pushed = await figma.pushContent(updates, input.fileKey)
    if (!pushed.success) {
      return NextResponse.json(
        { error: pushed.error ?? 'Figma export sync failed' },
        { status: 502 }
      )
    }

    if (input.assetDocumentId) {
      const supabase = createServiceClient()
      await supabase.from('design_quality_events').insert({
        workspace_id: workspaceId,
        asset_document_id: input.assetDocumentId,
        event_type: 'exported',
        edit_diff: {
          source: 'figma_sync_export',
          updateCount: updates.length,
          fileKey: input.fileKey,
        },
      })
    }

    return NextResponse.json({
      success: true,
      direction: 'export',
      result: pushed,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.errors }, { status: 400 })
    }
    console.error('[integrations/figma/sync] Error:', error)
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 })
  }
}

async function buildUpdatesFromAsset(
  assetDocumentId: string,
  workspaceId: string
): Promise<TextUpdate[]> {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('asset_documents')
    .select('id, blocks_json')
    .eq('id', assetDocumentId)
    .eq('workspace_id', workspaceId)
    .single()

  if (!data) return []

  const blocks = Array.isArray(data.blocks_json)
    ? (data.blocks_json as Array<Record<string, unknown>>)
    : []

  return blocks
    .filter((b) => typeof b.id === 'string' && typeof b.content === 'string')
    .map((b, index) => ({
      nodeId: String(b.id),
      text: String(b.content),
      layerName: typeof b.type === 'string' ? b.type : `layer-${index + 1}`,
    }))
}
