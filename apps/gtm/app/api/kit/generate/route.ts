/**
 * Kit Generation API - Streaming SSE endpoint
 * 
 * Generates a complete launch kit and streams progress updates.
 */

import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { generateLaunchKit } from '@/lib/kit/kit-generator'
import { getWorkspaceIdWithFallback, handleWorkspaceError } from '@/lib/workspace'
import type { LaunchKitBrief, KitGenerationOptions, GenerationProgress } from '@/lib/kit/kit-types'
import { buildGenerationPlan } from '@/lib/planning/generation-plan'

export const runtime = 'nodejs'
export const maxDuration = 300 // 5 minutes max

interface GenerateRequest {
  brief: LaunchKitBrief
  options?: KitGenerationOptions
}

export async function POST(request: NextRequest) {
  let workspaceId: string
  try {
    workspaceId = getWorkspaceIdWithFallback(request)
  } catch (err) {
    return handleWorkspaceError(err)
  }

  let body: GenerateRequest
  try {
    body = await request.json()
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON body' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const { brief, options } = body

  // Validate brief
  if (!brief || !brief.audience || !brief.offer || !brief.cta) {
    return new Response(
      JSON.stringify({ error: 'Brief must include audience, offer, and cta' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const reviewedPlan =
    brief.planning ??
    options?.plan ??
    await buildGenerationPlan({
      workspaceId,
      brandId: brief.brandId || undefined,
      designDirection: options?.designDirection,
      assetTypes: ['landing-page', 'email', 'social', 'deck'],
      brief: {
        name: brief.offer,
        audience: brief.audience,
        goal: brief.launchType ? `${brief.launchType} launch` : undefined,
        offer: brief.offer,
        cta: brief.cta,
        constraints: brief.constraints,
      },
    })

  const normalizedBrief: LaunchKitBrief = {
    ...brief,
    planning: reviewedPlan,
  }
  
  // Create a TransformStream for SSE
  const encoder = new TextEncoder()
  const stream = new TransformStream()
  const writer = stream.writable.getWriter()
  
  // Send SSE event helper
  const sendEvent = async (event: string, data: unknown) => {
    const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
    await writer.write(encoder.encode(message))
  }
  
  // Start generation in background
  ;(async () => {
    try {
      // Progress callback
      const onProgress = async (progress: GenerationProgress) => {
        await sendEvent('progress', progress)
      }
      
      // Generate the kit
      const kit = await generateLaunchKit(
        normalizedBrief,
        workspaceId,
        { ...(options || {}), plan: reviewedPlan },
        onProgress,
      )
      
      // Save to database
      const supabase = createServiceClient()
      const { data: savedKit, error: saveError } = await supabase
        .from('launch_kits')
        .insert({
          id: kit.id,
          workspace_id: workspaceId,
          brand_id: kit.brandId || null,
          brief: kit.brief,
          status: kit.status,
          assets: kit.assets,
          compliance: kit.compliance,
          angles: kit.angles,
        })
        .select()
        .single()
      
      if (saveError) {
        console.error('Failed to save kit:', saveError)
        await sendEvent('error', { message: 'Failed to save kit' })
      } else {
        await sendEvent('complete', { kit: savedKit })
      }
      
    } catch (error) {
      console.error('Kit generation error:', error)
      await sendEvent('error', { 
        message: error instanceof Error ? error.message : 'Generation failed' 
      })
    } finally {
      await writer.close()
    }
  })()
  
  return new Response(stream.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
