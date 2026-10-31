import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient as createClient } from '@/lib/supabase/server'
import { getWorkspaceContext } from '@/lib/workspace'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { workspaceId } = await getWorkspaceContext(request)

    const { data: brand, error } = await supabase
      .from('brands')
      .select('*, brand_assets(*)')
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .single()

    if (error || !brand) {
      return NextResponse.json({ error: 'Brand not found' }, { status: 404 })
    }

    return NextResponse.json({ brand })
  } catch (error) {
    console.error('Brand fetch error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { workspaceId } = await getWorkspaceContext(request)

    const body = await request.json()

    // If setting as default, unset other defaults first
    if (body.is_default) {
      await supabase
        .from('brands')
        .update({ is_default: false })
        .eq('workspace_id', workspaceId)
        .eq('is_default', true)
        .neq('id', id)
    }

    const { data: brand, error } = await supabase
      .from('brands')
      .update(body)
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .select()
      .single()

    if (error) {
      console.error('Failed to update brand:', error)
      return NextResponse.json({ error: 'Failed to update brand' }, { status: 500 })
    }

    return NextResponse.json({ brand })
  } catch (error) {
    console.error('Brand update error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { workspaceId } = await getWorkspaceContext(request)

    const { error } = await supabase
      .from('brands')
      .delete()
      .eq('id', id)
      .eq('workspace_id', workspaceId)

    if (error) {
      console.error('Failed to delete brand:', error)
      return NextResponse.json({ error: 'Failed to delete brand' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Brand delete error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
