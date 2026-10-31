import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createKnowledgeItem } from '@/lib/knowledge/knowledge-manager'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const contentType = searchParams.get('content_type')
    const status = searchParams.get('status')

    // Get user's workspace
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .single()

    if (!membership) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 404 })
    }

    let query = supabase
      .from('knowledge_items')
      .select('*')
      .eq('workspace_id', membership.workspace_id)
      .is('parent_id', null)

    if (contentType) {
      query = query.eq('content_type', contentType)
    }
    if (status) {
      query = query.eq('status', status)
    }

    const { data: items, error } = await query.order('updated_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(items)
  } catch (error) {
    console.error('GET /api/knowledge error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's workspace
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .single()

    if (!membership) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 404 })
    }

    const body = await request.json()
    const {
      title,
      description,
      content,
      content_type,
      source_url,
      file_path,
      file_name,
      file_size,
      mime_type,
      tags,
      metadata,
    } = body

    if (!title?.trim()) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }
    if (!content?.trim()) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 })
    }

    // Create knowledge item via manager — triggers real embedding generation
    const item = await createKnowledgeItem(membership.workspace_id, user.id, {
      title: title.trim(),
      description: description?.trim(),
      content: content.trim(),
      content_type: content_type || 'manual',
      source_url,
      file_path,
      file_name,
      file_size,
      mime_type,
      tags: tags || [],
      metadata: metadata || {},
    })

    if (!item) {
      return NextResponse.json({ error: 'Failed to create knowledge item' }, { status: 500 })
    }

    return NextResponse.json(item)
  } catch (error) {
    console.error('POST /api/knowledge error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
