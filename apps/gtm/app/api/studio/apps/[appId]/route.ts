import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ appId: string }> }
) {
  try {
    const { appId } = await params
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: app, error } = await supabase
      .from('studio_apps')
      .select('*')
      .eq('id', appId)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!app) {
      return NextResponse.json({ error: 'App not found' }, { status: 404 })
    }

    return NextResponse.json(app)
  } catch (error) {
    console.error('GET /api/studio/apps/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ appId: string }> }
) {
  try {
    const { appId } = await params
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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
      visibility,
      published_at,
    } = body

    const updates: Record<string, unknown> = {}
    if (name !== undefined) updates.name = name
    if (description !== undefined) updates.description = description
    if (icon !== undefined) updates.icon = icon
    if (category !== undefined) updates.category = category
    if (inputs !== undefined) updates.inputs = inputs
    if (instructions !== undefined) updates.instructions = instructions
    if (example_output !== undefined) updates.example_output = example_output
    if (model !== undefined) updates.model = model
    if (temperature !== undefined) updates.temperature = temperature
    if (max_tokens !== undefined) updates.max_tokens = max_tokens
    if (knowledge_items !== undefined) updates.knowledge_items = knowledge_items
    if (default_brand_id !== undefined) updates.default_brand_id = default_brand_id
    if (default_audience_id !== undefined) updates.default_audience_id = default_audience_id
    if (visibility !== undefined) updates.visibility = visibility
    if (published_at !== undefined) updates.published_at = published_at

    const { data: app, error } = await supabase
      .from('studio_apps')
      .update(updates)
      .eq('id', appId)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(app)
  } catch (error) {
    console.error('PATCH /api/studio/apps/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ appId: string }> }
) {
  try {
    const { appId } = await params
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { error } = await supabase
      .from('studio_apps')
      .delete()
      .eq('id', appId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/studio/apps/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
