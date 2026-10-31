/**
 * Memory API
 * 
 * CRUD operations and search for Production Memory.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceIdWithFallback } from '@/lib/workspace'
import { 
  createMemoryItem,
  searchMemory,
  getMemoryStats,
} from '@/lib/memory/memory-manager'
import type { CreateMemoryInput, MemorySearchInput } from '@/lib/memory/memory-types'

/**
 * GET /api/memory
 * Search memory or get stats
 */
export async function GET(request: NextRequest) {
  const workspaceId = getWorkspaceIdWithFallback(request)
  const { searchParams } = new URL(request.url)
  
  try {
    // If stats requested
    if (searchParams.get('stats') === 'true') {
      const stats = await getMemoryStats(workspaceId)
      return NextResponse.json({ stats })
    }
    
    // Otherwise search
    const query = searchParams.get('query')
    if (!query) {
      return NextResponse.json(
        { error: 'query parameter required for search' },
        { status: 400 }
      )
    }
    
    const searchInput: MemorySearchInput = {
      query,
      contentType: searchParams.get('contentType') as MemorySearchInput['contentType'] || undefined,
      status: searchParams.get('status') as MemorySearchInput['status'] || undefined,
      limit: parseInt(searchParams.get('limit') || '10'),
    }
    
    const results = await searchMemory(workspaceId, searchInput)
    return NextResponse.json({ results })
    
  } catch (error) {
    console.error('Memory search error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Search failed' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/memory
 * Create a new memory item
 */
export async function POST(request: NextRequest) {
  const workspaceId = getWorkspaceIdWithFallback(request)
  
  let body: CreateMemoryInput
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 }
    )
  }
  
  if (!body.contentType || !body.content) {
    return NextResponse.json(
      { error: 'contentType and content are required' },
      { status: 400 }
    )
  }
  
  try {
    const item = await createMemoryItem(workspaceId, body)
    return NextResponse.json({ item }, { status: 201 })
    
  } catch (error) {
    console.error('Memory create error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Create failed' },
      { status: 500 }
    )
  }
}
