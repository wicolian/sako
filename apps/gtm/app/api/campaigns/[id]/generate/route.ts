/**
 * Campaign Generation Orchestration API (Jan 2026)
 * 
 * Orchestrates multi-asset generation for a campaign with real-time
 * progress updates via Server-Sent Events.
 */

import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getWorkspaceIdWithFallback, handleWorkspaceError } from '@/lib/workspace'
import { type DesignDirection } from '@/lib/design/archetype-selector'
import { type GenerationPlan, type ReviewActionId } from '@/lib/planning/types'
import { generateCampaignAssets, type ProgressEvent } from '@/lib/campaigns/generate-campaign'
import { attachCampaignBrandId, resolveCampaignBrandId } from '@/lib/campaigns/brand-link'

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface GenerateRequest {
  assetTypes: string[]
  formats?: Record<string, string[]>
  validateClaims?: boolean
  useTemplates?: boolean
  designDirection?: DesignDirection
  plan?: GenerationPlan
  reviewAction?: ReviewActionId
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: campaignId } = await params
    let workspaceId: string
    try {
      workspaceId = getWorkspaceIdWithFallback(request)
    } catch (err) {
      return handleWorkspaceError(err)
    }

    const supabase = createServiceClient()

    let body: GenerateRequest
    try {
      body = await request.json()
    } catch {
      return jsonError('Invalid JSON body', 400)
    }

    const { assetTypes, formats = {}, validateClaims = true, useTemplates = true, designDirection = 'auto' } = body

    if (!assetTypes || !Array.isArray(assetTypes) || assetTypes.length === 0) {
      return jsonError('assetTypes array required', 400)
    }

    // Verify campaign exists and belongs to workspace
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', campaignId)
      .eq('workspace_id', workspaceId)
      .single()

    if (campaignError || !campaign) {
      return jsonError('Campaign not found', 404)
    }

    const campaignRecord = attachCampaignBrandId(campaign as Record<string, unknown>)
    const campaignConstraints =
      campaignRecord.constraints && typeof campaignRecord.constraints === 'object' && !Array.isArray(campaignRecord.constraints)
        ? (campaignRecord.constraints as Record<string, unknown>)
        : {}

    if (campaignConstraints.flow === 'url_import' && !resolveCampaignBrandId(campaignRecord)) {
      return jsonError('Imported campaigns require a saved brand link. Re-run the brand import and create the campaign again.', 409)
    }

    // Create SSE response
    const encoder = new TextEncoder()

    const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (event: ProgressEvent) => {
        const data = `data: ${JSON.stringify(event)}\n\n`
        controller.enqueue(encoder.encode(data))
      }
      
      try {
        await generateCampaignAssets(supabase, campaignRecord, {
          campaignId,
          workspaceId,
          assetTypes,
          formats,
          validateClaims,
          useTemplates,
          designDirection,
          plan: body.plan,
          reviewAction: body.reviewAction,
          onProgress: async (event) => {
            sendEvent(event)
          },
        })
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Generation failed'
        
        await supabase
          .from('campaigns')
          .update({ status: 'failed' })
          .eq('id', campaignId)
        
        sendEvent({
          step: 'error',
          progress: 0,
          status: 'Generation failed',
          error: errorMsg,
        })
      } finally {
        controller.close()
      }
    },
  })
  
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Generation failed'
    console.error('[campaigns/generate]', err)
    return jsonError(message, 500)
  }
}
