import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function POST(
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

    // Get original asset
    const { data: original, error: fetchError } = await supabase
      .from('project_assets')
      .select('*')
      .eq('id', assetId)
      .eq('project_id', projectId)
      .single()

    if (fetchError || !original) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 })
    }

    // Create duplicate
    const { data: duplicate, error: insertError } = await supabase
      .from('project_assets')
      .insert({
        project_id: original.project_id,
        name: `${original.name} (Copy)`,
        type: original.type,
        position_x: original.position_x + 50,
        position_y: original.position_y + 50,
        width: original.width,
        height: original.height,
        content: original.content,
        status: 'draft',
        connected_to: [],
        created_by: user.id,
      })
      .select()
      .single()

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    return NextResponse.json(duplicate)
  } catch (error) {
    console.error('POST /api/projects/[id]/assets/[id]/duplicate error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
