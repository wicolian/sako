/**
 * Single Memory Item API
 * 
 * Get, update, or delete a memory item.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceIdWithFallback } from '@/lib/workspace'
import { 
  getMemoryItem,
  updateMemoryItem,
  deleteMemoryItem,
} from '@/lib/memory/memory-manager'
import type { UpdateMemoryInput } from '@/lib/memory/memory-types'

/**
 * GET /api/memory/[id]
 * Get a single memory item
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const workspaceId = getWorkspaceIdWithFallback(request)
  
  try {
    const item = await getMemoryItem(id, workspaceId)
    
    if (!item) {
      return NextResponse.json(
        { error: 'Memory item not found' },
        { status: 404 }
      )
    }
    
    return NextResponse.json({ item })
    
  } catch (error) {
    console.error('Get memory item error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get item' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/memory/[id]
 * Update a memory item
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const workspaceId = getWorkspaceIdWithFallback(request)
  
  let body: UpdateMemoryInput
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 }
    )
  }
  
  try {
    const item = await updateMemoryItem(id, workspaceId, body)
    return NextResponse.json({ item })
    
  } catch (error) {
    console.error('Update memory item error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update item' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/memory/[id]
 * Delete a memory item
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const workspaceId = getWorkspaceIdWithFallback(request)
  
  try {
    await deleteMemoryItem(id, workspaceId)
    return NextResponse.json({ success: true })
    
  } catch (error) {
    console.error('Delete memory item error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete item' },
      { status: 500 }
    )
  }
}
