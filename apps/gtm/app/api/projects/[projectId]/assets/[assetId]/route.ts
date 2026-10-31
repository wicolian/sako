import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; assetId: string }> }
) {
  try {
    const { projectId, assetId } = await params
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: asset, error } = await supabase
      .from('project_assets')
      .select('*')
      .eq('id', assetId)
      .eq('project_id', projectId)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(asset)
  } catch (error) {
    console.error('GET /api/projects/[id]/assets/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; assetId: string }> }
) {
  try {
    const { projectId, assetId } = await params
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      name,
      position_x,
      position_y,
      content,
      html,
      status,
      connected_to,
      brand_id_override,
      audience_id_override,
      tone_override,
      custom_instructions,
    } = body

    const updates: Record<string, unknown> = {}
    if (name !== undefined) updates.name = name
    if (position_x !== undefined) updates.position_x = position_x
    if (position_y !== undefined) updates.position_y = position_y
    if (content !== undefined) updates.content = content
    if (html !== undefined) updates.html = html
    if (status !== undefined) updates.status = status
    if (connected_to !== undefined) updates.connected_to = connected_to
    if (brand_id_override !== undefined) updates.brand_id_override = brand_id_override
    if (audience_id_override !== undefined) updates.audience_id_override = audience_id_override
    if (tone_override !== undefined) updates.tone_override = tone_override
    if (custom_instructions !== undefined) updates.custom_instructions = custom_instructions

    const { data: asset, error } = await supabase
      .from('project_assets')
      .update(updates)
      .eq('id', assetId)
      .eq('project_id', projectId)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(asset)
  } catch (error) {
    console.error('PATCH /api/projects/[id]/assets/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; assetId: string }> }
) {
  try {
    const { projectId, assetId } = await params
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { error } = await supabase
      .from('project_assets')
      .delete()
      .eq('id', assetId)
      .eq('project_id', projectId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/projects/[id]/assets/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
