import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { updates } = body

    if (!Array.isArray(updates)) {
      return NextResponse.json({ error: 'Updates must be an array' }, { status: 400 })
    }

    // Batch update assets
    const results = await Promise.all(
      updates.map((update: { id: string; position_x?: number; position_y?: number; connected_to?: string[] }) =>
        supabase
          .from('project_assets')
          .update({
            position_x: update.position_x,
            position_y: update.position_y,
            connected_to: update.connected_to,
          })
          .eq('id', update.id)
          .eq('project_id', projectId)
      )
    )

    const hasError = results.some((r: { error: unknown }) => r.error)
    if (hasError) {
      return NextResponse.json({ error: 'Some updates failed' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('PATCH /api/projects/[id]/assets/batch error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
