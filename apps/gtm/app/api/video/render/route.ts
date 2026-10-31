/**
 * Video Rendering API
 * 
 * POST /api/video/render - Start a render job
 * GET /api/video/render - Get render jobs and status
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { 
  getRenderService, 
  renderVideo, 
  pollRenderStatus,
  type VideoTemplate,
  type VideoData,
} from '@/lib/video/render-service'
import { 
  isRemotionConfigured, 
  getRemotionStatus,
  storeRenderJob,
  updateRenderJobStatus,
} from '@/lib/video/remotion-lambda'
import { isVideoRenderingConfigured } from '@/lib/video/assembly'
import { enforceBudget } from '@/lib/enterprise/budget-enforcement'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get workspace
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .single()

    if (!membership) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 404 })
    }

    const workspaceId = membership.workspace_id

    // Check if video rendering is configured
    const renderConfig = isVideoRenderingConfigured()
    if (!renderConfig.configured) {
      return NextResponse.json(
        { 
          error: 'Video rendering is not configured',
          reason: renderConfig.reason,
          setupInstructions: 'Run ./infra/setup-remotion.sh to configure Remotion Lambda'
        },
        { status: 503 }
      )
    }

    // Check budget (~$0.50-2 per render depending on duration)
    const budgetCheck = await enforceBudget(workspaceId, 200)
    if (!budgetCheck.allowed) {
      return NextResponse.json(
        { error: budgetCheck.error || 'Budget exceeded' },
        { status: 402 }
      )
    }

    const body = await request.json()
    const { scriptId, campaignId, template, data } = body

    // If scriptId provided, get script from database
    let videoTemplate: VideoTemplate
    let videoData: VideoData = data || { modifications: {} }

    if (scriptId) {
      const { data: script } = await supabase
        .from('video_scripts')
        .select('*')
        .eq('id', scriptId)
        .single()

      if (!script) {
        return NextResponse.json(
          { error: 'Video script not found' },
          { status: 404 }
        )
      }

      // Convert script to template format
      videoTemplate = {
        id: script.id,
        name: script.title,
        duration: script.total_duration,
        aspectRatio: script.format || '16:9',
        scenes: (script.scenes || []).map((scene: any) => ({
          id: scene.id,
          duration: scene.duration,
          elements: [
            { type: 'text' as const, content: scene.textOverlay, position: { x: 0, y: 0 } },
          ],
        })),
      }
    } else if (template) {
      videoTemplate = template
    } else {
      return NextResponse.json(
        { error: 'Either scriptId or template is required' },
        { status: 400 }
      )
    }

    // Get render service (prefers Remotion Lambda)
    const service = getRenderService()

    // Start the render
    const result = await service.render(videoTemplate, videoData)

    if (!result.success || !result.renderId) {
      return NextResponse.json(
        { error: result.error || 'Failed to start render' },
        { status: 500 }
      )
    }

    // Store render job in database
    await supabase.from('video_renders').insert({
      id: result.renderId,
      workspace_id: workspaceId,
      campaign_id: campaignId || null,
      script_id: scriptId || null,
      template_id: videoTemplate.id,
      service: service.name,
      status: 'pending',
      preview_url: result.previewUrl,
      created_at: new Date().toISOString(),
    })

    return NextResponse.json({
      success: true,
      render: {
        id: result.renderId,
        service: service.name,
        status: 'pending',
        previewUrl: result.previewUrl,
      },
    })
  } catch (error) {
    console.error('Video render error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Render failed' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get workspace
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .single()

    if (!membership) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const renderId = searchParams.get('renderId')
    const campaignId = searchParams.get('campaignId')
    const limit = parseInt(searchParams.get('limit') || '20')

    // If renderId provided, get status for that specific render
    if (renderId) {
      const { data: render } = await supabase
        .from('video_renders')
        .select('*')
        .eq('id', renderId)
        .eq('workspace_id', membership.workspace_id)
        .single()

      if (!render) {
        return NextResponse.json(
          { error: 'Render not found' },
          { status: 404 }
        )
      }

      // Get live status from render service if still pending/processing
      if (render.status === 'pending' || render.status === 'processing') {
        try {
          const service = getRenderService()
          const status = await service.getStatus(renderId)

          // Update database if status changed
          if (status.status !== render.status) {
            await supabase
              .from('video_renders')
              .update({
                status: status.status,
                output_url: status.downloadUrl,
                thumbnail_url: status.thumbnailUrl,
                error: status.error,
                updated_at: new Date().toISOString(),
                completed_at: status.status === 'completed' ? new Date().toISOString() : null,
              })
              .eq('id', renderId)
          }

          return NextResponse.json({
            success: true,
            render: {
              id: render.id,
              service: render.service,
              status: status.status,
              progress: status.progress,
              outputUrl: status.downloadUrl,
              thumbnailUrl: status.thumbnailUrl,
              error: status.error,
            },
          })
        } catch {
          // If we can't get live status, return database status
        }
      }

      return NextResponse.json({
        success: true,
        render: {
          id: render.id,
          service: render.service,
          status: render.status,
          outputUrl: render.output_url,
          thumbnailUrl: render.thumbnail_url,
          error: render.error,
          createdAt: render.created_at,
          completedAt: render.completed_at,
        },
      })
    }

    // List renders for workspace
    let query = supabase
      .from('video_renders')
      .select('*')
      .eq('workspace_id', membership.workspace_id)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (campaignId) {
      query = query.eq('campaign_id', campaignId)
    }

    const { data: renders, error } = await query

    if (error) {
      throw error
    }

    // Also return rendering service status
    const serviceStatus = isVideoRenderingConfigured()
    const remotionStatus = isRemotionConfigured() ? await getRemotionStatus() : null

    return NextResponse.json({
      success: true,
      renders: (renders || []).map(r => ({
        id: r.id,
        service: r.service,
        status: r.status,
        outputUrl: r.output_url,
        thumbnailUrl: r.thumbnail_url,
        createdAt: r.created_at,
        completedAt: r.completed_at,
      })),
      count: renders?.length || 0,
      serviceStatus: {
        configured: serviceStatus.configured,
        service: serviceStatus.service,
        remotion: remotionStatus,
      },
    })
  } catch (error) {
    console.error('Error fetching render jobs:', error)
    return NextResponse.json(
      { error: 'Failed to fetch render jobs' },
      { status: 500 }
    )
  }
}
