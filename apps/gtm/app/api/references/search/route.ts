/**
 * References Search API
 * 
 * Search for referenceable items (templates, components, snippets, brands, audiences).
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { searchReferences, ReferenceType } from '@/lib/ai/context-reference'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q') || ''
    const typesParam = searchParams.get('types')
    const limit = parseInt(searchParams.get('limit') || '10')

    // Get workspace ID
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .single()

    if (!membership) {
      return NextResponse.json(
        { error: 'No workspace found' },
        { status: 404 }
      )
    }

    const types = typesParam
      ? (typesParam.split(',') as ReferenceType[])
      : undefined

    const results = await searchReferences(
      membership.workspace_id,
      query,
      types,
      limit
    )

    return NextResponse.json({ results })
  } catch (error) {
    console.error('GET /api/references/search error:', error)
    return NextResponse.json(
      { error: 'Failed to search references' },
      { status: 500 }
    )
  }
}
