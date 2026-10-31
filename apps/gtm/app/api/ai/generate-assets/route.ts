import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceContext, handleWorkspaceError } from '@/lib/workspace'
import { createServiceClient } from '@/lib/supabase/service'
import {
  generateEmailSequence,
  generateAdVariants,
  generateSalesOnePager,
  generateTalkTrack,
} from '@/lib/ai/multi-asset'
import type { Campaign } from '@/lib/supabase/types'

export async function POST(request: NextRequest) {
  try {
    const { workspaceId } = getWorkspaceContext(request)
    const { campaignId, assetType, options } = await request.json()
    const supabase = createServiceClient()

    if (!campaignId || !assetType) {
      return NextResponse.json(
        { error: 'campaignId and assetType are required' },
        { status: 400 }
      )
    }

    // Get campaign
    const { data: campaignData, error: campaignError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', campaignId)
      .eq('workspace_id', workspaceId)
      .single()

    if (campaignError || !campaignData) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    const campaign = campaignData as Campaign
    let result

    switch (assetType) {
      case 'email_sequence':
        result = await generateEmailSequence(campaign, workspaceId, options)
        break

      case 'ad_variants':
        result = await generateAdVariants(
          campaign,
          workspaceId,
          options?.platforms || ['linkedin', 'meta']
        )
        break

      case 'sales_one_pager':
        result = await generateSalesOnePager(campaign, workspaceId)
        break

      case 'talk_track':
        result = await generateTalkTrack(campaign, workspaceId)
        break

      default:
        return NextResponse.json(
          { error: `Unknown asset type: ${assetType}` },
          { status: 400 }
        )
    }

    // Optionally save to campaign assets
    if (options?.save) {
      await supabase.from('campaign_assets').insert({
        campaign_id: campaignId,
        workspace_id: workspaceId,
        asset_type: assetType,
        content: result,
      })
    }

    return NextResponse.json({ success: true, asset: result })
  } catch (error) {
    console.error('Error generating assets:', error)
    return handleWorkspaceError(error)
  }
}
