/**
 * Requests API
 * 
 * CRUD operations for the Request OS.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceIdWithFallback, getUserIdWithFallback } from '@/lib/workspace'
import { 
  createRequest, 
  listRequests, 
  getRequestStats 
} from '@/lib/requests/request-manager'
import type { CreateRequestInput, RequestListOptions } from '@/lib/requests/request-types'

/**
 * GET /api/requests
 * List requests with filters
 */
export async function GET(request: NextRequest) {
  const workspaceId = getWorkspaceIdWithFallback(request)
  const { searchParams } = new URL(request.url)
  
  try {
    // Parse filters from query params
    const filters: NonNullable<RequestListOptions['filters']> = {}
    const options: RequestListOptions = {
      filters,
      sortBy: (searchParams.get('sortBy') as RequestListOptions['sortBy']) || 'created_at',
      sortOrder: (searchParams.get('sortOrder') as RequestListOptions['sortOrder']) || 'desc',
      limit: parseInt(searchParams.get('limit') || '50'),
      offset: parseInt(searchParams.get('offset') || '0'),
    }
    
    // Parse array filters
    const status = searchParams.get('status')
    if (status) {
      filters.status = status.split(',') as NonNullable<RequestListOptions['filters']>['status']
    }
    
    const assetType = searchParams.get('assetType')
    if (assetType) {
      filters.assetType = assetType.split(',') as NonNullable<RequestListOptions['filters']>['assetType']
    }
    
    const priority = searchParams.get('priority')
    if (priority) {
      filters.priority = priority.split(',') as NonNullable<RequestListOptions['filters']>['priority']
    }
    
    const assigneeId = searchParams.get('assigneeId')
    if (assigneeId) {
      filters.assigneeId = assigneeId
    }
    
    const search = searchParams.get('search')
    if (search) {
      filters.search = search
    }
    
    // Check if stats requested
    if (searchParams.get('stats') === 'true') {
      const stats = await getRequestStats(workspaceId)
      return NextResponse.json({ stats })
    }
    
    const { requests, total } = await listRequests(workspaceId, options)
    
    return NextResponse.json({
      requests,
      total,
      limit: options.limit,
      offset: options.offset,
    })
    
  } catch (error) {
    console.error('List requests error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to list requests' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/requests
 * Create a new request
 */
export async function POST(request: NextRequest) {
  const workspaceId = getWorkspaceIdWithFallback(request)
  const userId = getUserIdWithFallback(request)
  
  let body: CreateRequestInput
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 }
    )
  }
  
  // Validate required fields
  if (!body.assetType || !body.title) {
    return NextResponse.json(
      { error: 'assetType and title are required' },
      { status: 400 }
    )
  }
  
  try {
    const newRequest = await createRequest(workspaceId, userId, body)
    
    return NextResponse.json({ request: newRequest }, { status: 201 })
    
  } catch (error) {
    console.error('Create request error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create request' },
      { status: 500 }
    )
  }
}
