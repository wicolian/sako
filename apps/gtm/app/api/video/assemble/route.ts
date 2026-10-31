/**
 * Video Assembly API (Jan 2026)
 * 
 * Assemble videos from scripts, voiceovers, and assets
 * using Creatomate, Shotstack, or Remotion.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getWorkspaceIdWithFallback } from '@/lib/workspace'
import { assembleVideo, isVideoRenderingConfigured, type AssemblyOptions } from '@/lib/video/assembly'
import type { VideoScript } from '@/lib/assets/video-script-generator'
import type { Voiceover } from '@/lib/video/voiceover'

export async function POST(request: NextRequest) {
  const supabase = createServiceClient()
  const workspaceId = getWorkspaceIdWithFallback(request)
  
  // Check if video rendering is configured
  const renderConfig = isVideoRenderingConfigured()
  
  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  
  const { 
    scriptId,
    assetId,
    script,
    voiceoverUrl,
    voiceoverId,
    templateId,
    assets = [],
    includeCaptions = true,
    resolution = '1080p',
    quality = 'standard',
  } = body
  
  try {
    // Get script from asset if not provided directly
    let videoScript: VideoScript
    
    if (script) {
      videoScript = script
    } else if (assetId) {
      const { data: asset, error: assetError } = await supabase
        .from('campaign_assets')
        .select('content')
        .eq('id', assetId)
        .eq('workspace_id', workspaceId)
        .maybeSingle()
      
      if (assetError || !asset) {
        return NextResponse.json({ error: 'Script asset not found' }, { status: 404 })
      }
      
      videoScript = asset.content as VideoScript
    } else if (scriptId) {
      // Legacy support for scriptId
      const { data: asset, error: assetError } = await supabase
        .from('campaign_assets')
        .select('content')
        .eq('workspace_id', workspaceId)
        .eq('asset_type', 'video_script')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      
      if (assetError || !asset) {
        return NextResponse.json({ error: 'Script not found' }, { status: 404 })
      }
      
      videoScript = asset.content as VideoScript
    } else {
      return NextResponse.json({ error: 'script, scriptId, or assetId is required' }, { status: 400 })
    }
    
    // Build voiceover object if URL provided
    let voiceover: Voiceover | null = null
    if (voiceoverUrl) {
      voiceover = {
        id: voiceoverId || `vo-${Date.now()}`,
        scriptId: videoScript.id,
        voiceId: '',
        voiceName: 'Custom',
        audioUrl: voiceoverUrl,
        duration: videoScript.totalDuration,
        characterCount: videoScript.voiceoverText.length,
        cost: 0,
        segments: [], // No segments for custom voiceover URL
        provider: 'elevenlabs', // Default provider
        settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.5,
          use_speaker_boost: true,
        },
        createdAt: new Date(),
      }
    }
    
    // Assembly options
    const options: AssemblyOptions = {
      templateId,
      assets,
      includeCaptions,
      resolution: resolution as '720p' | '1080p' | '4k',
      quality: quality as 'draft' | 'standard' | 'high',
    }
    
    // Assemble the video
    const assembledVideo = await assembleVideo(
      videoScript,
      voiceover,
      workspaceId,
      options
    )
    
    // Save render job to database
    const { data: renderJob, error: saveError } = await supabase
      .from('campaign_assets')
      .insert({
        workspace_id: workspaceId,
        asset_type: 'video_render',
        format: videoScript.format,
        content: {
          scriptId: videoScript.id,
          voiceoverId: voiceover?.id,
          templateId,
          resolution,
          quality,
        },
        render_job_id: assembledVideo.id,
        render_status: assembledVideo.status,
        media_url: assembledVideo.videoUrl || null,
        thumbnail_url: assembledVideo.thumbnailUrl || null,
        status: assembledVideo.status === 'complete' ? 'draft' : 'processing',
      })
      .select()
      .maybeSingle()
    
    if (saveError) {
      console.error('Failed to save render job:', saveError)
    }
    
    return NextResponse.json({
      video: assembledVideo,
      assetId: renderJob?.id,
      status: assembledVideo.status,
      renderingService: renderConfig.service,
      message: assembledVideo.status === 'rendering' 
        ? 'Video is being rendered. Poll /api/video/[id]/status for updates.'
        : assembledVideo.status === 'complete'
        ? 'Video rendering complete!'
        : 'Video render queued.',
    }, { status: 202 })
    
  } catch (error) {
    console.error('Video assembly failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Video assembly failed' },
      { status: 500 }
    )
  }
}
