/**
 * Kit Generation API - Streaming SSE endpoint
 *
 * Creates a primary campaign record, generates assets through the shared
 * campaign pipeline, then persists a linked launch kit bundle.
 */

import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getWorkspaceIdWithFallback, handleWorkspaceError } from '@/lib/workspace'
import type { LaunchKitBrief, KitGenerationOptions } from '@/lib/kit/kit-types'
import { buildGenerationPlan } from '@/lib/planning/generation-plan'
import { generateCampaignAssets } from '@/lib/campaigns/generate-campaign'
import {
  buildLaunchKitFromCampaignGeneration,
  isMissingLaunchKitsTableError,
} from '@/lib/kit/launch-kit-store'
import { mergeCampaignBrandConstraint } from '@/lib/campaigns/brand-link'

export const runtime = 'nodejs'
export const maxDuration = 300

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
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const { brief, options } = body
  if (!brief || !brief.audience || !brief.offer || !brief.cta) {
    return new Response(
      JSON.stringify({ error: 'Brief must include audience, offer, and cta' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
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

  const supabase = createServiceClient()
  const storageCheck = await supabase.from('launch_kits').select('id').limit(1)
  if (storageCheck.error && isMissingLaunchKitsTableError(storageCheck.error.message)) {
    return new Response(
      JSON.stringify({
        error:
          'Launch kit storage is unavailable in this environment. Apply the missing Supabase migrations before generating campaigns from /kit/new.',
      }),
      { status: 503, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const constraints = mergeCampaignBrandConstraint(
    {
      mustInclude: normalizedBrief.constraints.mustInclude,
      mustAvoid: normalizedBrief.constraints.mustAvoid,
      generation_plan: reviewedPlan,
      launch_type: normalizedBrief.launchType,
      launch_kit: true,
    },
    normalizedBrief.brandId || null,
  )

  const { data: campaign, error: campaignError } = await supabase
    .from('campaigns')
    .insert({
      workspace_id: workspaceId,
      name: `Launch Kit: ${normalizedBrief.offer}`.slice(0, 120),
      audience: normalizedBrief.audience,
      goal: normalizedBrief.launchType ? `${normalizedBrief.launchType} launch` : normalizedBrief.offer,
      offer: normalizedBrief.offer,
      cta: normalizedBrief.cta,
      brand_id: normalizedBrief.brandId || null,
      constraints,
      status: 'draft',
    })
    .select()
    .single()

  if (campaignError || !campaign) {
    return new Response(
      JSON.stringify({ error: campaignError?.message || 'Failed to create campaign' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const encoder = new TextEncoder()
  const stream = new TransformStream()
  const writer = stream.writable.getWriter()

  const sendEvent = async (event: string, data: unknown) => {
    const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
    await writer.write(encoder.encode(message))
  }

  ;(async () => {
    try {
      const generationResult = await generateCampaignAssets(
        supabase,
        campaign as Record<string, unknown>,
        {
          campaignId: campaign.id,
          workspaceId,
          assetTypes: ['landing-page', 'ads', 'email', 'social', 'deck'],
          formats: {
            email: ['nurture'],
            social: ['linkedin', 'twitter', 'facebook', 'instagram'],
          },
          validateClaims: true,
          useTemplates: true,
          designDirection: options?.designDirection,
          plan: reviewedPlan,
          onProgress: async (progress) => {
            await sendEvent('progress', {
              step: progress.step,
              progress: progress.progress,
              message: progress.status,
              assetType: progress.assetType,
              error: progress.error,
            })
          },
        },
      )

      const kit = buildLaunchKitFromCampaignGeneration({
        kitId: crypto.randomUUID(),
        campaignId: campaign.id,
        workspaceId,
        brandId: normalizedBrief.brandId || undefined,
        brief: normalizedBrief,
        assets: generationResult.generatedAssets,
        assetDocuments: generationResult.assetDocuments,
        angles: [],
      })

      const { data: savedKit, error: saveError } = await supabase
        .from('launch_kits')
        .insert({
          id: kit.id,
          workspace_id: workspaceId,
          campaign_id: campaign.id,
          brand_id: kit.brandId || null,
          brief: kit.brief,
          status: kit.status,
          assets: kit.assets,
          compliance: kit.compliance,
          angles: kit.angles,
        })
        .select('*')
        .single()

      if (saveError) {
        await supabase
          .from('campaigns')
          .update({ status: 'failed' })
          .eq('id', campaign.id)

        throw new Error(
          isMissingLaunchKitsTableError(saveError.message)
            ? 'Launch kit storage is unavailable in this environment. Apply the required Supabase migrations and retry.'
            : `Failed to save launch kit: ${saveError.message}`,
        )
      }

      await sendEvent('complete', {
        campaignId: campaign.id,
        kit: buildLaunchKitFromCampaignGeneration({
          kitId: savedKit.id,
          campaignId: campaign.id,
          workspaceId: savedKit.workspace_id,
          brandId: savedKit.brand_id,
          brief: savedKit.brief,
          assets: savedKit.assets,
          assetDocuments: generationResult.assetDocuments,
          createdAt: new Date(savedKit.created_at),
          updatedAt: new Date(savedKit.updated_at),
          status: savedKit.status,
          angles: savedKit.angles ?? [],
        }),
      })
    } catch (error) {
      console.error('Kit generation error:', error)
      await supabase
        .from('campaigns')
        .update({ status: 'failed' })
        .eq('id', campaign.id)

      await sendEvent('error', {
        message: error instanceof Error ? error.message : 'Generation failed',
        campaignId: campaign.id,
      })
    } finally {
      await writer.close()
    }
  })()

  return new Response(stream.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
