/**
 * Single Kit API
 * 
 * Get, update, or delete a kit.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getWorkspaceIdWithFallback } from '@/lib/workspace'
import { isMissingLaunchKitsTableError, mapLaunchKitRecord, type LaunchKitRecord } from '@/lib/kit/launch-kit-store'

/**
 * GET /api/kit/[id]
 * Get a single kit
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const workspaceId = getWorkspaceIdWithFallback(request)
  const supabase = createServiceClient()
  
  const { data: kit, error } = await supabase
    .from('launch_kits')
    .select('*')
    .eq('id', id)
    .eq('workspace_id', workspaceId)
    .single()
  
  if (error || !kit) {
    if (error && isMissingLaunchKitsTableError(error.message)) {
      return NextResponse.json(
        { error: 'Launch kit storage is unavailable. Apply the required Supabase migrations.' },
        { status: 503 }
      )
    }
    return NextResponse.json(
      { error: 'Kit not found' },
      { status: 404 }
    )
  }
  
  return NextResponse.json({ kit: mapLaunchKitRecord(kit as LaunchKitRecord) })
}

/**
 * PATCH /api/kit/[id]
 * Update a kit
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const workspaceId = getWorkspaceIdWithFallback(request)
  
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 }
    )
  }
  
  const supabase = createServiceClient()
  
  // Only allow updating certain fields
  const allowedFields = ['status', 'assets', 'compliance']
  const updateData: Record<string, unknown> = {}
  
  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      updateData[field] = body[field]
    }
  }
  
  if (Object.keys(updateData).length === 0) {
    return NextResponse.json(
      { error: 'No valid fields to update' },
      { status: 400 }
    )
  }
  
  const { data: kit, error } = await supabase
    .from('launch_kits')
    .update(updateData)
    .eq('id', id)
    .eq('workspace_id', workspaceId)
    .select()
    .single()
  
  if (error) {
    return NextResponse.json(
      { error: 'Failed to update kit' },
      { status: 500 }
    )
  }
  
  return NextResponse.json({ kit })
}

/**
 * DELETE /api/kit/[id]
 * Delete a kit
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const workspaceId = getWorkspaceIdWithFallback(request)
  const supabase = createServiceClient()
  
  const { error } = await supabase
    .from('launch_kits')
    .delete()
    .eq('id', id)
    .eq('workspace_id', workspaceId)
  
  if (error) {
    return NextResponse.json(
      { error: 'Failed to delete kit' },
      { status: 500 }
    )
  }
  
  return NextResponse.json({ success: true })
}
