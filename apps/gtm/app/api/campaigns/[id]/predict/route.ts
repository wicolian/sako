import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceContext, handleWorkspaceError } from '@/lib/workspace'
import { createServiceClient } from '@/lib/supabase/service'
import { predictCampaignPerformance } from '@/lib/learning/performance-prediction'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: campaignId } = await params
    const { workspaceId } = getWorkspaceContext(request)
    const supabase = createServiceClient()

    // Get campaign
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', campaignId)
      .eq('workspace_id', workspaceId)
      .single()

    if (campaignError || !campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    // Get page blocks
    const { data: pageBlocks } = await supabase
      .from('page_blocks')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('order_index')

    if (!pageBlocks || pageBlocks.length === 0) {
      return NextResponse.json({
        error: 'No page content to analyze. Add content to get predictions.',
      }, { status: 400 })
    }

    // Generate prediction
    const prediction = await predictCampaignPerformance(
      campaign,
      pageBlocks,
      workspaceId
    )

    return NextResponse.json(prediction)
  } catch (error) {
    console.error('Error predicting performance:', error)
    return handleWorkspaceError(error)
  }
}
