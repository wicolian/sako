import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { generateInstagramStoryAd } from '@/lib/assets/ad-generator'

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
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

    const workspaceId = membership.workspace_id
    const body = await request.json()

    const { campaignId, campaign, options } = body

    // Get campaign from database if campaignId provided
    let campaignData = campaign
    if (campaignId && !campaign) {
      const { data, error } = await supabase
        .from('campaigns')
        .select('*')
        .eq('id', campaignId)
        .eq('workspace_id', workspaceId)
        .single()

      if (error || !data) {
        return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
      }
      campaignData = data
    }

    if (!campaignData) {
      return NextResponse.json(
        { error: 'Campaign or campaignId required' },
        { status: 400 }
      )
    }

    const ads = await generateInstagramStoryAd(campaignData, workspaceId, options || {})

    return NextResponse.json({ ads })
  } catch (error) {
    console.error('Instagram Story ad generation error:', error)
    return NextResponse.json(
      { error: 'Failed to generate Instagram Story ads' },
      { status: 500 }
    )
  }
}
