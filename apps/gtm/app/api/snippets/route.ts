/**
 * Snippets API
 * 
 * CRUD operations for code snippets.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  createSnippet,
  getSnippets,
  getSnippet,
  updateSnippet,
  deleteSnippet,
  toggleFavorite,
  recordSnippetUsage,
  getPopularSnippets,
  SnippetCategory,
} from '@/lib/snippets/snippet-manager'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get workspace ID
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .single()

    if (!membership) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const snippetId = searchParams.get('id')
    const category = searchParams.get('category') as SnippetCategory | null
    const search = searchParams.get('search')
    const tags = searchParams.get('tags')?.split(',').filter(Boolean)
    const includePublic = searchParams.get('includePublic') === 'true'
    const favoritesOnly = searchParams.get('favorites') === 'true'
    const popular = searchParams.get('popular') === 'true'
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    if (snippetId) {
      const snippet = await getSnippet(snippetId)
      if (!snippet) {
        return NextResponse.json({ error: 'Snippet not found' }, { status: 404 })
      }
      return NextResponse.json({ snippet })
    }

    if (popular) {
      const snippets = await getPopularSnippets(membership.workspace_id, limit)
      return NextResponse.json({ snippets })
    }

    const snippets = await getSnippets(membership.workspace_id, {
      category: category || undefined,
      search: search || undefined,
      tags,
      includePublic,
      favoritesOnly,
      userId: user.id,
      limit,
      offset,
    })

    return NextResponse.json({ snippets })
  } catch (error) {
    console.error('GET /api/snippets error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch snippets' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { action } = body

    // Get workspace ID
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .single()

    if (!membership) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 404 })
    }

    switch (action) {
      case 'create': {
        const { name, description, category, code, language, tags, is_public } = body

        if (!name || !code) {
          return NextResponse.json(
            { error: 'Name and code are required' },
            { status: 400 }
          )
        }

        const snippet = await createSnippet({
          workspace_id: membership.workspace_id,
          name,
          description,
          category,
          code,
          language,
          tags,
          is_public,
          created_by: user.id,
        })

        return NextResponse.json({ snippet })
      }

      case 'favorite': {
        const { snippetId } = body

        if (!snippetId) {
          return NextResponse.json(
            { error: 'snippetId is required' },
            { status: 400 }
          )
        }

        const isFavorited = await toggleFavorite(snippetId, user.id)
        return NextResponse.json({ isFavorited })
      }

      case 'use': {
        const { snippetId } = body

        if (!snippetId) {
          return NextResponse.json(
            { error: 'snippetId is required' },
            { status: 400 }
          )
        }

        await recordSnippetUsage(snippetId)
        return NextResponse.json({ success: true })
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('POST /api/snippets error:', error)
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { snippetId, name, description, category, code, language, tags, is_public } = body

    if (!snippetId) {
      return NextResponse.json(
        { error: 'snippetId is required' },
        { status: 400 }
      )
    }

    const snippet = await updateSnippet(snippetId, {
      name,
      description,
      category,
      code,
      language,
      tags,
      is_public,
    })

    return NextResponse.json({ snippet })
  } catch (error) {
    console.error('PATCH /api/snippets error:', error)
    return NextResponse.json(
      { error: 'Failed to update snippet' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const snippetId = searchParams.get('id')

    if (!snippetId) {
      return NextResponse.json(
        { error: 'snippetId is required' },
        { status: 400 }
      )
    }

    await deleteSnippet(snippetId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/snippets error:', error)
    return NextResponse.json(
      { error: 'Failed to delete snippet' },
      { status: 500 }
    )
  }
}
