/**
 * Video Script Generation API (Jan 2026)
 * 
 * Generate video scripts for campaigns with scene-by-scene breakdown.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getWorkspaceIdWithFallback } from '@/lib/workspace'
import { 
  generateVideoScript, 
  generateShortFormScript,
  type VideoFormat,
  type VideoStyle,
} from '@/lib/assets/video-script-generator'

export async function POST(request: NextRequest) {
  const supabase = createServiceClient()
  const workspaceId = getWorkspaceIdWithFallback(request)
  
  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  
  const { 
    campaignId, 
    format = '16:9', 
    duration = 60, 
    style = 'explainer',
    hookStyle,
    shortForm = false,
  } = body
  
  if (!campaignId) {
    return NextResponse.json({ error: 'campaignId is required' }, { status: 400 })
  }
  
  try {
    // Fetch campaign
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', campaignId)
      .eq('workspace_id', workspaceId)
      .maybeSingle()
    
    if (campaignError || !campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }
    
    // Generate script
    let script
    if (shortForm) {
      script = await generateShortFormScript(campaign as any, workspaceId, {
        duration: duration as 15 | 30 | 60,
      })
    } else {
      script = await generateVideoScript(
        campaign as any, 
        workspaceId, 
        format as VideoFormat, 
        {
          duration,
          style: style as VideoStyle,
          hookStyle,
        }
      )
    }
    
    // Save as campaign asset
    const { data: asset, error: assetError } = await supabase
      .from('campaign_assets')
      .insert({
        campaign_id: campaignId,
        workspace_id: workspaceId,
        asset_type: 'video_script',
        format: script.format,
        content: script,
        status: 'draft',
      })
      .select()
      .maybeSingle()
    
    if (assetError) {
      console.error('Failed to save script asset:', assetError)
    }
    
    return NextResponse.json({
      script,
      assetId: asset?.id,
    }, { status: 201 })
    
  } catch (error) {
    console.error('Script generation failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Script generation failed' },
      { status: 500 }
    )
  }
}
