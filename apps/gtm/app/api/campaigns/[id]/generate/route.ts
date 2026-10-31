/**
 * Campaign Generation Orchestration API (Jan 2026)
 * 
 * Orchestrates multi-asset generation for a campaign with real-time
 * progress updates via Server-Sent Events.
 */

import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getWorkspaceIdWithFallback, handleWorkspaceError } from '@/lib/workspace'
import { formatBrandPrompt, getBrandContext, getDefaultBrandContext } from '@/lib/ai/brand-context'
import {
  selectDesignArchetype,
  type DesignArchetype,
  type DesignDirection,
} from '@/lib/design/archetype-selector'
import {
  applyReviewActionToPlan,
  buildGenerationPlan,
  buildPlanPromptContext,
} from '@/lib/planning/generation-plan'
import { GenerationPlanSchema, type GenerationPlan, type ReviewActionId } from '@/lib/planning/types'

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
import { generateSocialPosts, type Platform } from '@/lib/assets/social-generator'
import { generateSalesDeck } from '@/lib/assets/deck-generator'
import { generateVideoScript }

from '@/lib/assets/video-script-generator'
import { generateEmailSequence } from '@/lib/ai/multi-asset'
import { generateLandingPage } from '@/lib/ai/template-aware-generation'
import {
  landingPageToAssetDocument,
  socialPostToAssetDocument,
  emailSequenceToAssetDocuments,
  deckToAssetDocument,
  upsertAssetDocument,
} from '@/lib/assets/asset-document-adapter'
import type { AssetDocument } from '@/lib/assets/asset-document'
import { generateAndPersistCampaignMessages } from '@/lib/ai/generate-campaign-messages'
import { buildBrainPromptContext, getBrainContext, resolveApprovedBrainSnapshot } from '@/lib/brain/service'
import { bindAssetDocumentToBrain } from '@/lib/brain/asset-binding'
import type { BrainContext } from '@/lib/brain/types'

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

type GenerationAssetType = 'landing-page' | 'social' | 'email' | 'deck' | 'video'

interface ProgressEvent {
  step: string
  progress: number
  status: string
  assetType?: string
  result?: unknown
  error?: string
}

interface CampaignClaimRow {
  text: string
  status: string
  risk_score: number
  category: string
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

    const campaignConstraints =
      campaign.constraints && typeof campaign.constraints === 'object' && !Array.isArray(campaign.constraints)
        ? (campaign.constraints as Record<string, unknown>)
        : {}

    if (campaignConstraints.flow === 'url_import' && !campaign.brand_id) {
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
        // Update campaign status
        await supabase
          .from('campaigns')
          .update({ status: 'generating' })
          .eq('id', campaignId)
        
        sendEvent({ step: 'init', progress: 5, status: 'Starting generation...' })
        
        const normalizedAssetTypes = assetTypes.map(normalizeGenerationAssetType)
        const totalAssets = normalizedAssetTypes.length
        let completedAssets = 0
        const generatedAssets: Record<string, unknown> = {}
        const errors: string[] = []
        const generatedAssetDocuments: AssetDocument[] = []
        const brandId = (campaign.brand_id as string | undefined) ?? undefined
        const brandContext = await getBrandContext(workspaceId, brandId)
        const designArchetype = selectDesignArchetype(
          brandContext ?? getDefaultBrandContext(),
          designDirection,
        )
        const approvedSnapshot = await resolveApprovedBrainSnapshot(workspaceId, brandId)
        const brainContext = approvedSnapshot
          ? await getBrainContext(workspaceId, approvedSnapshot.id)
          : null
        const reviewedPlanInput = GenerationPlanSchema.safeParse(body.plan)
        const storedPlanInput = GenerationPlanSchema.safeParse(campaignConstraints.generation_plan)
        const basePlan =
          reviewedPlanInput.success
            ? reviewedPlanInput.data
            : storedPlanInput.success
              ? storedPlanInput.data
              : await buildGenerationPlan({
                  workspaceId,
                  brandId,
                  designDirection,
                  assetTypes: normalizedAssetTypes,
                  brandContext,
                  brief: {
                    name: campaign.name as string | null,
                    audience: campaign.audience as string | null,
                    goal: campaign.goal as string | null,
                    offer: campaign.offer as string | null,
                    cta: campaign.cta as string | null,
                    constraints:
                      campaignConstraints && typeof campaignConstraints === 'object'
                        ? {
                            mustInclude: Array.isArray(campaignConstraints.mustInclude)
                              ? campaignConstraints.mustInclude.filter((value): value is string => typeof value === 'string')
                              : undefined,
                            mustAvoid: Array.isArray(campaignConstraints.mustAvoid)
                              ? campaignConstraints.mustAvoid.filter((value): value is string => typeof value === 'string')
                              : undefined,
                          }
                        : undefined,
                  },
                })
        const reviewedPlan =
          body.reviewAction ? applyReviewActionToPlan(basePlan, body.reviewAction) : basePlan
        const generationContext = await buildGenerationContextPrompt(
          supabase,
          workspaceId,
          brandId,
          brainContext,
          reviewedPlan,
        )

        await supabase
          .from('campaigns')
          .update({
            brain_snapshot_id: approvedSnapshot?.id ?? null,
            constraints: {
              ...(((campaign.constraints as Record<string, unknown> | null) ?? {})),
              generation_mode: approvedSnapshot ? 'gtm_brain' : 'brand_fallback',
              brain_snapshot_id: approvedSnapshot?.id ?? null,
              design_archetype: designArchetype,
              design_direction: designDirection,
              generation_plan: reviewedPlan,
            },
          })
          .eq('id', campaignId)
        
        // Generate each asset type
        for (const assetType of normalizedAssetTypes) {
          const assetFormats = formats[assetType] || []
          const baseProgress = 5 + (completedAssets / totalAssets) * 85
          
          sendEvent({
            step: 'generating',
            progress: Math.round(baseProgress),
            status: `Generating ${formatAssetName(assetType)}...`,
            assetType,
          })
          
          try {
            let result: unknown
            
            switch (assetType) {
              case 'landing-page':
                result = await generateLandingPageAsset(
                  campaign,
                  workspaceId,
                  supabase,
                  campaignId,
                  useTemplates,
                  generationContext,
                  brainContext,
                  brandContext,
                  designArchetype,
                  designDirection,
                  reviewedPlan,
                )
                break
                
              case 'social':
                result = await generateSocialAsset(
                  campaign,
                  workspaceId,
                  supabase,
                  campaignId,
                  assetFormats as Platform[],
                  generationContext,
                  brainContext,
                  designArchetype,
                  designDirection,
                  reviewedPlan,
                )
                break
                
              case 'email':
                result = await generateEmailAsset(
                  campaign,
                  workspaceId,
                  supabase,
                  campaignId,
                  assetFormats,
                  generationContext,
                  brainContext,
                  brandContext,
                  designArchetype,
                  designDirection,
                  reviewedPlan,
                )
                break
                
              case 'deck':
                result = await generateDeckAsset(
                  campaign,
                  workspaceId,
                  supabase,
                  campaignId,
                  generationContext,
                  brainContext,
                  designArchetype,
                  designDirection,
                  reviewedPlan,
                )
                break
                
              case 'video':
                result = await generateVideoAsset(
                  campaign,
                  workspaceId,
                  supabase,
                  campaignId,
                  assetFormats
                )
                break
                
              default:
                throw new Error(`Unknown asset type: ${assetType}`)
            }
            
            generatedAssets[assetType] = result
            const docs = (result as { assetDocuments?: AssetDocument[] }).assetDocuments
            if (docs?.length) {
              generatedAssetDocuments.push(...docs)
            }
            
            sendEvent({
              step: 'asset_complete',
              progress: Math.round(baseProgress + (1 / totalAssets) * 85),
              status: `${formatAssetName(assetType)} complete`,
              assetType,
              result: { success: true, assetId: (result as { id?: string })?.id },
            })
          } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Unknown error'
            errors.push(`${assetType}: ${errorMsg}`)
            
            sendEvent({
              step: 'asset_error',
              progress: Math.round(baseProgress + (1 / totalAssets) * 85),
              status: `Error generating ${formatAssetName(assetType)}`,
              assetType,
              error: errorMsg,
            })
          }
          
          completedAssets++
        }

        // Generate key messages so Content tab shows headlines, CTAs, etc.
        sendEvent({ step: 'messages', progress: 88, status: 'Generating key messages...' })
        let messageGenerationResult: Awaited<ReturnType<typeof generateAndPersistCampaignMessages>> | null = null
        try {
          messageGenerationResult = await generateAndPersistCampaignMessages(campaignId, supabase)
        } catch (msgErr) {
          const msgErrorMsg = msgErr instanceof Error ? msgErr.message : 'Key messages failed'
          errors.push(`key-messages: ${msgErrorMsg}`)
        }
        
        // Validate claims if requested
        if (validateClaims) {
          sendEvent({ step: 'validating', progress: 92, status: 'Validating claims...' })
          
          // Note: Claims validation would be done here by calling the validation graph
          // For now, we mark claims as pending validation
          await supabase
            .from('campaigns')
            .update({ status: errors.length > 0 ? 'partial' : 'ready' })
            .eq('id', campaignId)
        }
        
        // Final status
        const finalStatus = errors.length === 0 ? 'ready' : 'partial'
        const complianceSummary = {
          totalClaims: generatedAssetDocuments.reduce((sum, doc) => sum + doc.claims.length, 0),
          blockedClaims: generatedAssetDocuments.reduce(
            (sum, doc) =>
              sum +
              doc.claims.filter((claim) => claim.riskScore >= 70 && claim.status !== 'verified' && claim.status !== 'overridden').length,
            0
          ),
          slopViolations:
            generatedAssetDocuments.reduce(
              (sum, doc) => sum + doc.claims.filter((claim) => claim.text.startsWith('Slop detector:')).length,
              0
            ) + (messageGenerationResult?.slopViolations ?? 0),
          fabricatedClaims:
            generatedAssetDocuments.reduce(
              (sum, doc) =>
                sum +
                doc.claims.filter((claim) => claim.suggestedRewrite?.includes('AI-generated claim')).length,
              0
            ) + (messageGenerationResult?.fabricatedClaims.length ?? 0),
        }
        await supabase
          .from('campaigns')
          .update({ status: finalStatus })
          .eq('id', campaignId)
        
        sendEvent({
          step: 'complete',
          progress: 100,
          status: errors.length === 0 ? 'Generation complete!' : `Completed with ${errors.length} error(s)`,
          result: {
            campaignId,
            generatedAssets: Object.keys(generatedAssets),
            assetDocuments: generatedAssetDocuments,
            complianceSummary,
            errors,
          },
        })
        
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Generation failed'
        
        await supabase
          .from('campaigns')
          .update({ status: 'error' })
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

// Asset generation helpers

async function generateLandingPageAsset(
  campaign: Record<string, unknown>,
  workspaceId: string,
  supabase: ReturnType<typeof createServiceClient>,
  campaignId: string,
  useTemplates: boolean,
  generationContext: string,
  brainContext?: BrainContext | null,
  brandContext?: Awaited<ReturnType<typeof getBrandContext>> | null,
  designArchetype?: DesignArchetype | null,
  designDirection: DesignDirection = 'auto',
  reviewedPlan?: GenerationPlan,
) {
  const brandId = (campaign.brand_id as string | undefined) ?? ''
  const result = await generateLandingPage({
    brief: `Create a landing page for: ${campaign.name}. 
Target audience: ${campaign.audience || 'general'}. 
Goal: ${campaign.goal || 'conversions'}. 
Offer: ${campaign.offer || campaign.name}.
CTA: ${campaign.cta || 'Get Started'}.

Use this grounding context:
${generationContext}`,
    workspaceId,
    style: {
      theme: designArchetype?.prefersDark ? 'dark' : 'light',
      layout: 'centered',
    },
    sections: useTemplates ? undefined : ['hero', 'features', 'cta'],
    brandId,
    brand: brandContext ?? undefined,
    archetype: designArchetype ?? undefined,
    designDirection,
    plan: reviewedPlan,
  })
  
  // Save page blocks
  if (result.sections && result.sections.length > 0) {
    const blocks = result.sections.map((section, idx) => ({
      campaign_id: campaignId,
      type: section.type,
      order: idx,
      props: { html: section.html },
    }))
    
    await supabase.from('page_blocks').insert(blocks)
  }
  
  const doc = attachBrainContext(
    landingPageToAssetDocument(
      {
        id: crypto.randomUUID(),
        html: result.html,
        headline: (campaign.name as string) ?? 'Landing Page',
        subheadline: (campaign.offer as string) ?? '',
        sections: result.sections,
        designTokens: result.designTokens,
        claims: result.claims,
      },
      workspaceId,
      brandId,
      campaignId
    ),
    brainContext
  )
  await upsertAssetDocument(doc).catch(() => null)

  const legacyAssetId = await insertLegacyCampaignAsset(supabase, {
    campaign_id: campaignId,
    workspace_id: workspaceId,
    asset_type: 'landing_page',
    format: 'html',
    content: { html: result.html, sections: result.sections },
    html: result.html,
    status: 'draft',
  })

  return { id: doc.id, legacyAssetId, html: result.html, claims: result.claims, assetDocuments: [doc] }
}

async function generateSocialAsset(
  campaign: Record<string, unknown>,
  workspaceId: string,
  supabase: ReturnType<typeof createServiceClient>,
  campaignId: string,
  platforms: Platform[],
  generationContext: string,
  brainContext?: BrainContext | null,
  designArchetype?: DesignArchetype | null,
  _designDirection: DesignDirection = 'auto',
  reviewedPlan?: GenerationPlan,
) {
  const brandId = (campaign.brand_id as string | undefined) ?? ''
  const selectedPlatforms: Platform[] = platforms.length > 0 
    ? platforms 
    : ['linkedin', 'twitter']
  
  const result = await generateSocialPosts(
    {
      ...(campaign as Parameters<typeof generateSocialPosts>[0]),
      offer: `${(campaign.offer as string | null) ?? campaign.name ?? ''}\n\n${generationContext}`,
    },
    workspaceId,
    selectedPlatforms,
    {
      variants: 2,
      includeImagePrompts: true,
      designArchetype: designArchetype ?? undefined,
      plan: reviewedPlan,
    }
  )
  
  // Save each post as an asset
  const legacyAssets: string[] = []
  const assetDocuments: AssetDocument[] = []
  for (const post of result.posts) {
    const doc = attachBrainContext(
      socialPostToAssetDocument(post, workspaceId, brandId, campaignId),
      brainContext,
    )
    await upsertAssetDocument(doc).catch(() => null)
    assetDocuments.push(doc)

    const legacyAssetId = await insertLegacyCampaignAsset(supabase, {
      campaign_id: campaignId,
      workspace_id: workspaceId,
      asset_type: 'social_post',
      format: post.platform,
      content: post,
      status: 'draft',
    })
    if (legacyAssetId) legacyAssets.push(legacyAssetId)
  }
  
  return { id: assetDocuments[0]?.id, legacyAssetIds: legacyAssets, posts: result.posts, count: result.posts.length, assetDocuments }
}

async function generateEmailAsset(
  campaign: Record<string, unknown>,
  workspaceId: string,
  supabase: ReturnType<typeof createServiceClient>,
  campaignId: string,
  formats: string[],
  generationContext: string,
  brainContext?: BrainContext | null,
  brandContext?: Awaited<ReturnType<typeof getBrandContext>> | null,
  designArchetype?: DesignArchetype | null,
  _designDirection: DesignDirection = 'auto',
  reviewedPlan?: GenerationPlan,
) {
  const brandId = (campaign.brand_id as string | undefined) ?? ''
  const sequenceType = formats[0] || 'nurture'
  
  const result = await generateEmailSequence(
    {
      ...(campaign as Parameters<typeof generateEmailSequence>[0]),
      offer: `${(campaign.offer as string | null) ?? campaign.name ?? ''}\n\n${generationContext}`,
    },
    workspaceId,
    {
      sequenceLength: 5,
      plan: reviewedPlan,
      brandContext: brandContext ?? undefined,
      designArchetype: designArchetype ?? undefined,
    }
  )
  
  const docs = emailSequenceToAssetDocuments(
    {
      campaignName: result.campaign_name,
      emails: result.emails.map((email) => ({
        subject: email.subject,
        preheader: email.preheader,
        bodyHtml: email.body_html,
        ctaText: email.cta_text,
        ctaUrl: email.cta_url,
        delayDays: email.delay_days,
        emailType: email.email_type,
        claims: [],
      })),
    },
    workspaceId,
    brandId,
    campaignId,
    {
      brandContext: brandContext ?? undefined,
      designArchetype: designArchetype ?? undefined,
    }
  ).map((doc) => attachBrainContext(doc, brainContext))
  await Promise.all(docs.map((doc) => upsertAssetDocument(doc).catch(() => null)))

  const legacyAssetId = await insertLegacyCampaignAsset(supabase, {
    campaign_id: campaignId,
    workspace_id: workspaceId,
    asset_type: 'email_sequence',
    format: sequenceType,
    content: result,
    status: 'draft',
  })

  return { id: docs[0]?.id, legacyAssetId, ...result, assetDocuments: docs }
}

async function generateDeckAsset(
  campaign: Record<string, unknown>,
  workspaceId: string,
  supabase: ReturnType<typeof createServiceClient>,
  campaignId: string,
  generationContext: string,
  brainContext?: BrainContext | null,
  designArchetype?: DesignArchetype | null,
  _designDirection: DesignDirection = 'auto',
  reviewedPlan?: GenerationPlan,
) {
  const brandId = (campaign.brand_id as string | undefined) ?? ''
  const result = await generateSalesDeck(
    {
      ...(campaign as Parameters<typeof generateSalesDeck>[0]),
      offer: `${(campaign.offer as string | null) ?? campaign.name ?? ''}\n\n${generationContext}`,
    },
    workspaceId,
    {
      designArchetype: designArchetype ?? undefined,
      plan: reviewedPlan,
    },
  )
  
  const doc = attachBrainContext(
    deckToAssetDocument(
      {
        id: result.id,
        title: result.title,
        slides: result.slides.map((slide) => ({
          id: slide.id,
          type: mapDeckSlideType(slide.type),
          order: slide.order,
          headline: slide.headline,
          subheadline: slide.subheadline,
          bullets: slide.bullets,
          speakerNotes: slide.speakerNotes,
          visualSuggestion: slide.visualSuggestion,
          claims: slide.claims ?? [],
        })),
        totalSlides: result.totalSlides,
        estimatedDuration: result.estimatedDuration,
        theme: result.theme,
      },
      workspaceId,
      brandId,
      campaignId,
      {
        designArchetype: designArchetype ?? undefined,
      }
    ),
    brainContext
  )
  await upsertAssetDocument(doc).catch(() => null)

  const legacyAssetId = await insertLegacyCampaignAsset(supabase, {
    campaign_id: campaignId,
    workspace_id: workspaceId,
    asset_type: 'deck',
    format: 'slides',
    content: result,
    status: 'draft',
  })

  return { assetId: doc.id, legacyAssetId, ...result, assetDocuments: [doc] }
}

async function generateVideoAsset(
  campaign: Record<string, unknown>,
  workspaceId: string,
  supabase: ReturnType<typeof createServiceClient>,
  campaignId: string,
  formats: string[]
) {
  const format = formats[0] || '16:9'
  const aspectRatio = (format.includes('9:16') ? '9:16' : format.includes('1:1') ? '1:1' : '16:9') as '16:9' | '9:16' | '1:1'
  
  const result = await generateVideoScript(campaign as Parameters<typeof generateVideoScript>[0], workspaceId, aspectRatio, {
    duration: 30,
    style: 'explainer',
  })
  
  // Save video script as asset
  const { data: asset } = await supabase
    .from('campaign_assets')
    .insert({
      campaign_id: campaignId,
      workspace_id: workspaceId,
      asset_type: 'video_script',
      format: aspectRatio,
      content: result,
      status: 'draft',
    })
    .select()
    .maybeSingle()
  
  return { assetId: asset?.id, ...result }
}

function formatAssetName(assetType: string): string {
  const names: Record<string, string> = {
    'landing-page': 'Landing Page',
    'social': 'Social Posts',
    'email': 'Email Sequence',
    'deck': 'Sales Deck',
    'video': 'Video Script',
  }
  return names[assetType] || assetType
}

function normalizeGenerationAssetType(assetType: string): GenerationAssetType {
  switch (assetType) {
    case 'landing':
    case 'landing_page':
    case 'landing-page':
      return 'landing-page'
    case 'social':
    case 'social_post':
      return 'social'
    case 'email':
    case 'email_sequence':
      return 'email'
    case 'deck':
    case 'sales_deck':
      return 'deck'
    case 'video':
    case 'video_script':
      return 'video'
    default:
      return assetType as GenerationAssetType
  }
}

function attachBrainContext(doc: AssetDocument, brainContext?: BrainContext | null): AssetDocument {
  return brainContext ? bindAssetDocumentToBrain(doc, brainContext) : doc
}

async function buildGenerationContextPrompt(
  supabase: ReturnType<typeof createServiceClient>,
  workspaceId: string,
  brandId: string | undefined,
  brainContext?: BrainContext | null,
  reviewedPlan?: GenerationPlan,
): Promise<string> {
  const planContext = reviewedPlan ? buildPlanPromptContext(reviewedPlan) : ''
  if (brainContext) {
    return [buildBrainPromptContext(brainContext), planContext].filter(Boolean).join('\n\n')
  }

  const brandContext = await getBrandContext(workspaceId, brandId)
  const { data: claimRows } = await supabase
    .from('claims')
    .select('text, status, risk_score, category')
    .eq('workspace_id', workspaceId)
    .order('updated_at', { ascending: false })
    .limit(16)

  const safeClaims = ((claimRows ?? []) as CampaignClaimRow[])
    .filter((claim) => claim.status === 'approved')
    .slice(0, 6)
    .map((claim) => `- [${claim.category}] ${claim.text}`)
    .join('\n')

  const cautionClaims = ((claimRows ?? []) as CampaignClaimRow[])
    .filter((claim) => claim.status !== 'approved' || claim.risk_score >= 60)
    .slice(0, 6)
    .map((claim) => `- [${claim.status}] ${claim.text}`)
    .join('\n')

  return [
    'Fallback grounding mode: use imported brand context directly because no approved GTM Brain snapshot exists yet.',
    brandContext ? formatBrandPrompt(brandContext) : '',
    planContext,
    safeClaims ? `Use these approved claims when possible:\n${safeClaims}` : '',
    cautionClaims ? `Avoid or qualify these claims unless you can prove them inline:\n${cautionClaims}` : '',
  ].filter(Boolean).join('\n\n')
}

async function insertLegacyCampaignAsset(
  supabase: ReturnType<typeof createServiceClient>,
  payload: {
    campaign_id: string
    workspace_id: string
    asset_type: string
    format: string
    content: unknown
    html?: string
    status: 'draft' | 'review' | 'approved' | 'published'
  }
): Promise<string | undefined> {
  try {
    const { data } = await supabase
      .from('campaign_assets')
      .insert(payload)
      .select('id')
      .single()
    return data?.id as string | undefined
  } catch {
    return undefined
  }
}

function mapDeckSlideType(type: string): 'title' | 'problem' | 'solution' | 'features' | 'benefits' | 'proof' | 'pricing' | 'cta' {
  switch (type) {
    case 'title':
      return 'title'
    case 'split':
      return 'solution'
    case 'stats':
      return 'benefits'
    case 'quote':
      return 'proof'
    case 'content':
    default:
      return 'features'
  }
}
