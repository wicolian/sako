import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getWorkspaceId } from '@/lib/workspace'
import {
  assetDocumentToRow,
  rowToAssetDocument,
  type AssetDocumentRow,
  type AssetDocument,
  type ContentBlock,
} from '@/lib/assets/asset-document'
import { createServiceClient } from '@/lib/supabase/service'

const ContentBlockTypeSchema = z.enum([
  'headline',
  'subheadline',
  'body',
  'cta',
  'image',
  'logo',
  'list',
  'testimonial',
  'stat',
  'divider',
  'spacer',
  'custom',
])

const UpdateAssetSchema = z.object({
  html: z.string().min(1),
  blocks: z.array(z.object({
    id: z.string(),
    type: ContentBlockTypeSchema,
    content: z.string(),
    position: z.object({
      x: z.number(),
      y: z.number(),
      width: z.number().optional(),
      height: z.number().optional(),
    }).optional(),
    style: z.record(z.string()).optional(),
    locked: z.boolean().optional(),
  })).optional(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const workspaceId = getWorkspaceId(request)
  if (!workspaceId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('asset_documents')
    .select('*')
    .eq('id', id)
    .eq('workspace_id', workspaceId)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Asset not found' }, { status: 404 })
  }

  return NextResponse.json({ assetDocument: rowToAssetDocument(data as AssetDocumentRow) })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const workspaceId = getWorkspaceId(request)
  if (!workspaceId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const supabase = createServiceClient()

  try {
    const body = await request.json()
    const input = UpdateAssetSchema.parse(body)

    const { data: existing, error: fetchError } = await supabase
      .from('asset_documents')
      .select('*')
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 })
    }

    const current = rowToAssetDocument(existing as AssetDocumentRow)
    const updatedBlocks: ContentBlock[] = input.blocks
      ? input.blocks.map((block) => ({
          id: block.id,
          type: block.type,
          content: block.content,
          position: block.position,
          style: block.style,
          locked: block.locked,
        }))
      : current.blocks

    const updatedDoc: AssetDocument = {
      ...current,
      html: input.html,
      blocks: updatedBlocks,
      parentRevisionId: current.parentRevisionId,
      revision: (current.revision ?? 0) + 1,
      updatedAt: new Date().toISOString(),
    }

    const row = assetDocumentToRow(updatedDoc)
    const { data: saved, error: saveError } = await supabase
      .from('asset_documents')
      .update({
        html: row.html,
        blocks_json: row.blocks_json,
        revision: row.revision,
        parent_revision_id: row.parent_revision_id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .select('*')
      .single()

    if (saveError || !saved) {
      return NextResponse.json({ error: 'Failed to save asset' }, { status: 500 })
    }

    return NextResponse.json({ assetDocument: rowToAssetDocument(saved as AssetDocumentRow) })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid payload', details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: 'Failed to save asset' }, { status: 500 })
  }
}
