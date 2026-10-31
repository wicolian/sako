/**
 * Single Campaign Asset API (Jan 2026)
 * 
 * Get, update, and delete individual campaign assets.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getWorkspaceIdWithFallback } from '@/lib/workspace'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; assetId: string }> }
) {
  const { id: campaignId, assetId } = await params
  const supabase = createServiceClient()
  const workspaceId = getWorkspaceIdWithFallback(request)
  
  const { data: asset, error } = await supabase
    .from('campaign_assets')
    .select('*')
    .eq('id', assetId)
    .eq('campaign_id', campaignId)
    .eq('workspace_id', workspaceId)
    .maybeSingle()
  
  if (error || !asset) {
    return NextResponse.json({ error: 'Asset not found' }, { status: 404 })
  }
  
  return NextResponse.json({ asset })
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; assetId: string }> }
) {
  const { id: campaignId, assetId } = await params
  const supabase = createServiceClient()
  const workspaceId = getWorkspaceIdWithFallback(request)
  
  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  
  // Only allow updating specific fields
  const allowedFields = ['content', 'html', 'status', 'format', 'render_job_id', 'render_status', 'media_url', 'thumbnail_url']
  const updateData: Record<string, unknown> = {}
  
  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      updateData[field] = body[field]
    }
  }
  
  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }
  
  const { data: asset, error } = await supabase
    .from('campaign_assets')
    .update(updateData)
    .eq('id', assetId)
    .eq('campaign_id', campaignId)
    .eq('workspace_id', workspaceId)
    .select()
    .maybeSingle()
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  
  if (!asset) {
    return NextResponse.json({ error: 'Asset not found' }, { status: 404 })
  }
  
  return NextResponse.json({ asset })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; assetId: string }> }
) {
  const { id: campaignId, assetId } = await params
  const supabase = createServiceClient()
  const workspaceId = getWorkspaceIdWithFallback(request)
  
  const { error } = await supabase
    .from('campaign_assets')
    .delete()
    .eq('id', assetId)
    .eq('campaign_id', campaignId)
    .eq('workspace_id', workspaceId)
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  
  return NextResponse.json({ success: true })
}
