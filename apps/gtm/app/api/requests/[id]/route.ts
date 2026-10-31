/**
 * Single Request API
 * 
 * Operations on individual requests.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceIdWithFallback, getUserIdWithFallback } from '@/lib/workspace'
import { 
  getRequest, 
  updateRequest, 
  addFeedback 
} from '@/lib/requests/request-manager'
import type { UpdateRequestInput, AddFeedbackInput } from '@/lib/requests/request-types'
import { createServiceClient } from '@/lib/supabase/service'

/**
 * GET /api/requests/[id]
 * Get a single request
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const workspaceId = getWorkspaceIdWithFallback(request)
  
  try {
    const req = await getRequest(id, workspaceId)
    
    if (!req) {
      return NextResponse.json(
        { error: 'Request not found' },
        { status: 404 }
      )
    }
    
    return NextResponse.json({ request: req })
    
  } catch (error) {
    console.error('Get request error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get request' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/requests/[id]
 * Update a request
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const workspaceId = getWorkspaceIdWithFallback(request)
  
  let body: UpdateRequestInput
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 }
    )
  }
  
  try {
    const updated = await updateRequest(id, workspaceId, body)
    return NextResponse.json({ request: updated })
    
  } catch (error) {
    console.error('Update request error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update request' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/requests/[id]
 * Add feedback to a request
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const workspaceId = getWorkspaceIdWithFallback(request)
  const userId = getUserIdWithFallback(request)
  
  let body: AddFeedbackInput
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 }
    )
  }
  
  if (!body.content || !body.type) {
    return NextResponse.json(
      { error: 'content and type are required' },
      { status: 400 }
    )
  }
  
  try {
    // Get user name
    const supabase = createServiceClient()
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', userId)
      .single()
    
    const userName = profile?.full_name || profile?.email || 'Unknown'
    
    const updated = await addFeedback(id, workspaceId, userId, userName, body)
    return NextResponse.json({ request: updated })
    
  } catch (error) {
    console.error('Add feedback error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to add feedback' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/requests/[id]
 * Delete a request (soft delete via status change)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const workspaceId = getWorkspaceIdWithFallback(request)
  
  try {
    const updated = await updateRequest(id, workspaceId, { status: 'cancelled' })
    return NextResponse.json({ request: updated })
    
  } catch (error) {
    console.error('Delete request error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete request' },
      { status: 500 }
    )
  }
}
