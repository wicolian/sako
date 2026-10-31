/**
 * Video Render Status API (Jan 2026)
 * 
 * Check the status of a video render job.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getWorkspaceIdWithFallback } from '@/lib/workspace'
import { getRenderStatus } from '@/lib/video/assembly'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: videoId } = await params
  const supabase = createServiceClient()
  const workspaceId = getWorkspaceIdWithFallback(request)
  
  const { searchParams } = new URL(request.url)
  const service = searchParams.get('service') as 'creatomate' | 'shotstack' | null
  
  try {
    // First check our database for the asset
    const { data: asset, error: assetError } = await supabase
      .from('campaign_assets')
      .select('*')
      .eq('render_job_id', videoId)
      .eq('workspace_id', workspaceId)
      .single()
    
    // If we have a completed asset, return it
    if (asset && asset.render_status === 'complete') {
      return NextResponse.json({
        id: videoId,
        status: 'complete',
        progress: 100,
        videoUrl: asset.media_url,
        thumbnailUrl: asset.thumbnail_url,
        assetId: asset.id,
      })
    }
    
    // Otherwise, check with the render service
    const detectedService = service || detectService()
    const renderStatus = await getRenderStatus(videoId, detectedService)
    
    // Update our database if status changed
    if (renderStatus.status === 'complete' && renderStatus.url) {
      await supabase
        .from('campaign_assets')
        .update({
          render_status: 'complete',
          media_url: renderStatus.url,
          status: 'draft',
        })
        .eq('render_job_id', videoId)
        .eq('workspace_id', workspaceId)
    } else if (renderStatus.status === 'failed') {
      await supabase
        .from('campaign_assets')
        .update({
          render_status: 'failed',
          status: 'error',
        })
        .eq('render_job_id', videoId)
        .eq('workspace_id', workspaceId)
    }
    
    return NextResponse.json({
      id: videoId,
      status: renderStatus.status,
      progress: renderStatus.progress,
      videoUrl: renderStatus.url,
      error: renderStatus.error,
      assetId: asset?.id,
    })
    
  } catch (error) {
    console.error('Status check failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Status check failed' },
      { status: 500 }
    )
  }
}

function detectService(): 'creatomate' | 'shotstack' {
  if (process.env.CREATOMATE_API_KEY) return 'creatomate'
  if (process.env.SHOTSTACK_API_KEY) return 'shotstack'
  return 'creatomate' // default
}
