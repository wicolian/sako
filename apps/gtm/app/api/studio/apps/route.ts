import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const visibility = searchParams.get('visibility')
    const category = searchParams.get('category')

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
      .from('studio_apps')
      .select('*')
      .eq('workspace_id', membership.workspace_id)

    if (visibility) {
      query = query.eq('visibility', visibility)
    }
    if (category) {
      query = query.eq('category', category)
    }

    const { data: apps, error } = await query.order('updated_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(apps)
  } catch (error) {
    console.error('GET /api/studio/apps error:', error)
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
      name,
      description,
      icon,
      category,
      inputs,
      instructions,
      example_output,
      model,
      temperature,
      max_tokens,
      knowledge_items,
      default_brand_id,
      default_audience_id,
    } = body

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }
    if (!instructions?.trim()) {
      return NextResponse.json({ error: 'Instructions are required' }, { status: 400 })
    }

    // Create app
    const { data: app, error } = await supabase
      .from('studio_apps')
      .insert({
        workspace_id: membership.workspace_id,
        name: name.trim(),
        description: description?.trim() || null,
        icon: icon || '🤖',
        category: category || 'custom',
        inputs: inputs || [],
        instructions: instructions.trim(),
        example_output: example_output?.trim() || null,
        model: model || 'openai/gpt-5.3-chat',
        temperature: temperature ?? 0.7,
        max_tokens: max_tokens || null,
        knowledge_items: knowledge_items || [],
        default_brand_id: default_brand_id || null,
        default_audience_id: default_audience_id || null,
        visibility: 'private',
        run_count: 0,
        created_by: user.id,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(app)
  } catch (error) {
    console.error('POST /api/studio/apps error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
