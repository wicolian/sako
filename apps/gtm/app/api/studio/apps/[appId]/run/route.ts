import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { runApp } from '@/lib/studio/app-runner'

export async function POST(
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
    const { inputs, brand_id, audience_id, knowledge_ids } = body

    // Run the app
    const result = await runApp(appId, user.id, {
      inputs: inputs || {},
      brand_id,
      audience_id,
      knowledge_ids,
    })

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      output: result.output,
      tokensUsed: result.tokensUsed,
      latencyMs: result.latencyMs,
      run: result.run,
    })
  } catch (error) {
    console.error('POST /api/studio/apps/[id]/run error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
