import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { extractFactCitations, getLearningInsights } from '@/lib/brain/learning'

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: membership } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .single()

    if (!membership?.workspace_id) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 404 })
    }

    const insights = await getLearningInsights(membership.workspace_id)
    return NextResponse.json(insights)
  } catch (error) {
    console.error('GET /api/brain/feedback error:', error)
    return NextResponse.json({ error: 'Failed to load learning insights' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { campaignId } = body as { campaignId?: string }

    if (!campaignId) {
      return NextResponse.json({ error: 'campaignId is required' }, { status: 400 })
    }

    const result = await extractFactCitations(campaignId)
    return NextResponse.json(result)
  } catch (error) {
    console.error('POST /api/brain/feedback error:', error)
    return NextResponse.json({ error: 'Failed to record fact citations' }, { status: 500 })
  }
}
