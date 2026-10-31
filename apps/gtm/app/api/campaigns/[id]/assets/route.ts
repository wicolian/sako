/**
 * Campaign Assets API (Feb 2026)
 *
 * Serves canonical AssetDocuments from the UADM table.
 * Falls back to legacy campaign_assets for backward compatibility.
 *
 * GET  /api/campaigns/[id]/assets — List assets (canonical + legacy shim)
 * POST /api/campaigns/[id]/assets — Create asset as canonical AssetDocument
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/service'
import { getWorkspaceId } from '@/lib/workspace'
import { resolveCampaignBrandId } from '@/lib/campaigns/brand-link'
import {
  rowToAssetDocument,
  type AssetDocumentRow,
  type AssetType,
  type Channel,
  createAssetDocument,
  assetDocumentToRow,
} from '@/lib/assets/asset-document'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: campaignId } = await params
  const supabase = createServiceClient()
  const workspaceId = getWorkspaceId(request)

  // Verify campaign belongs to workspace
  const { data: campaign, error: campaignError } = await supabase
    .from('campaigns')
    .select('id')
    .eq('id', campaignId)
    .eq('workspace_id', workspaceId)
    .single()

  if (campaignError || !campaign) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
  }

  const { searchParams } = new URL(request.url)
  const assetType = searchParams.get('type')
  const status = searchParams.get('status')
  const format = searchParams.get('format') // 'canonical' | 'legacy' | null

  // Primary: fetch from canonical asset_documents
  let canonicalQuery = supabase
    .from('asset_documents')
    .select('*')
    .eq('campaign_id', campaignId)
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })

  if (assetType) canonicalQuery = canonicalQuery.eq('asset_type', assetType)
  if (status) canonicalQuery = canonicalQuery.eq('status', status)

  const { data: canonicalRows } = await canonicalQuery

  const assetDocuments = (canonicalRows ?? []).map((row) =>
    rowToAssetDocument(row as unknown as AssetDocumentRow)
  )

  // If client requests legacy format, also fetch from campaign_assets for backward compat
  if (format === 'legacy' || !canonicalRows?.length) {
    let legacyQuery = supabase
      .from('campaign_assets')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('created_at', { ascending: false })

    if (assetType) legacyQuery = legacyQuery.eq('asset_type', assetType)
    if (status) legacyQuery = legacyQuery.eq('status', status)

    const { data: legacyAssets } = await legacyQuery

    return NextResponse.json({
      assetDocuments,
      assets: legacyAssets ?? [], // backward compat field
      total: assetDocuments.length + (legacyAssets?.length ?? 0),
    })
  }

  return NextResponse.json({
    assetDocuments,
    assets: assetDocuments, // backward compat: same data
    total: assetDocuments.length,
  })
}

const CreateAssetSchema = z.object({
  asset_type: z.enum(['landing', 'social', 'email', 'deck', 'ad']),
  channel: z.string().optional(),
  html: z.string().default(''),
  content: z.unknown().optional(), // legacy field
  format: z.string().optional(),   // legacy field
  status: z.enum(['draft', 'review', 'approved', 'published']).default('draft'),
  brandId: z.string().uuid().optional(),
  title: z.string().optional(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: campaignId } = await params
  const supabase = createServiceClient()
  const workspaceId = getWorkspaceId(request)

  // Verify campaign belongs to workspace
  const { data: campaign, error: campaignError } = await supabase
    .from('campaigns')
    .select('id, constraints')
    .eq('id', campaignId)
    .eq('workspace_id', workspaceId)
    .single()

  if (campaignError || !campaign) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const input = CreateAssetSchema.parse(body)

  // Create canonical AssetDocument
  const doc = createAssetDocument({
    workspaceId,
    brandId: input.brandId ?? resolveCampaignBrandId(campaign as Record<string, unknown>) ?? '',
    campaignId,
    type: input.asset_type as AssetType,
    channel: (input.channel as Channel) ?? undefined,
    html: input.html || (typeof input.content === 'string' ? input.content : ''),
    title: input.title,
  })

  // Persist to canonical table
  const row = assetDocumentToRow(doc)
  const { error } = await supabase
    .from('asset_documents')
    .insert(row)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Also write to legacy campaign_assets for backward compat (non-critical)
  try {
    await supabase
      .from('campaign_assets')
      .insert({
        campaign_id: campaignId,
        workspace_id: workspaceId,
        asset_type: input.asset_type,
        format: input.format,
        content: input.content,
        html: input.html,
        status: input.status,
      })
  } catch { /* legacy table may not exist */ }

  return NextResponse.json({ asset: doc, assetDocument: doc }, { status: 201 })
}
