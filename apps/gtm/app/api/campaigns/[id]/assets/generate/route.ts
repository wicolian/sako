/**
 * Generate Single Asset API (Jan 2026)
 * 
 * Generate a specific asset type for a campaign.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getWorkspaceIdWithFallback } from '@/lib/workspace'
import { attachCampaignBrandId, resolveCampaignBrandId } from '@/lib/campaigns/brand-link'
import { generateSocialPosts, type Platform } from '@/lib/assets/social-generator'
import { generateSalesDeck } from '@/lib/assets/deck-generator'
import { generateVideoScript, type VideoStyle } from '@/lib/assets/video-script-generator'
import { generateEmailSequence } from '@/lib/ai/multi-asset'
import { generateLandingPage } from '@/lib/ai/template-aware-generation'
import { z } from 'zod'
import { buildGenerationPlan, applyReviewActionToPlan } from '@/lib/planning/generation-plan'
import {
  GenerationPlanSchema,
  ReviewActionSchema,
  type GenerationPlan,
  type ReviewActionId,
} from '@/lib/planning/types'
import { buildSurgicalRegenerationContext, evaluateAssetOutput } from '@/lib/planning/output-evaluator'
import {
  landingPageToAssetDocument,
  socialPostToAssetDocument,
  emailSequenceToAssetDocuments,
  deckToAssetDocument,
  upsertAssetDocument,
} from '@/lib/assets/asset-document-adapter'
import type { AssetDocument } from '@/lib/assets/asset-document'
import {
  createWebsiteDesignFromGeneratedPage,
  persistCampaignLandingDesign,
  projectDesignToPageBlocks,
} from '@/lib/campaigns/landing-design'

const GenerateAssetSchema = z.object({
  assetType: z.string().min(1),
  formats: z.array(z.string()).optional(),
  options: z.object({
    style: z.object({
      theme: z.enum(['dark', 'light', 'gradient', 'glass']).optional(),
      layout: z.enum(['centered', 'split', 'grid', 'asymmetric', 'stacked']).optional(),
    }).optional(),
    videoStyle: z.enum(['explainer', 'testimonial', 'product', 'brand', 'announcement']).optional(),
    variants: z.number().int().min(1).max(8).optional(),
    emailCount: z.number().int().min(1).max(12).optional(),
    duration: z.number().int().min(5).max(300).optional(),
  }).optional(),
  channels: z.array(z.string()).optional(),
  brandId: z.string().uuid().optional(),
  styleProfile: z.object({
    theme: z.enum(['dark', 'light', 'gradient', 'glass']).optional(),
    layout: z.enum(['centered', 'split', 'grid', 'asymmetric', 'stacked']).optional(),
  }).optional(),
  plan: GenerationPlanSchema.optional(),
  reviewAction: ReviewActionSchema.optional(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: campaignId } = await params
  const supabase = createServiceClient()
  const workspaceId = getWorkspaceIdWithFallback(request)
  
  // Verify campaign exists and belongs to workspace
  const { data: campaign, error: campaignError } = await supabase
    .from('campaigns')
    .select('*')
    .eq('id', campaignId)
    .eq('workspace_id', workspaceId)
    .single()
  
  if (campaignError || !campaign) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
  }

  const campaignRecord = attachCampaignBrandId(campaign as Record<string, unknown>)
  
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = GenerateAssetSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 })
  }

  const normalizedAssetType = normalizeAssetType(parsed.data.assetType)

  const {
    formats = [],
    options = {},
    channels = [],
    brandId,
    styleProfile,
    plan,
    reviewAction,
  } = parsed.data

  const campaignConstraints =
    campaignRecord.constraints && typeof campaignRecord.constraints === 'object'
      ? (campaignRecord.constraints as Record<string, unknown>)
      : {}
  const resolvedCampaignBrandId = resolveCampaignBrandId(campaignRecord)
  const reviewedPlanInput = GenerationPlanSchema.safeParse(plan)
  const storedPlanInput = GenerationPlanSchema.safeParse(campaignConstraints.generation_plan)
  const basePlan =
    reviewedPlanInput.success
      ? reviewedPlanInput.data
      : storedPlanInput.success
        ? storedPlanInput.data
        : await buildGenerationPlan({
            workspaceId,
            brandId: brandId || resolvedCampaignBrandId,
            assetTypes: [normalizePlanAssetType(normalizedAssetType)],
            brief: {
              name: campaignRecord.name as string | null,
              audience: campaignRecord.audience as string | null,
              goal: campaignRecord.goal as string | null,
              offer: campaignRecord.offer as string | null,
              cta: campaignRecord.cta as string | null,
              constraints: {
                mustInclude: Array.isArray(campaignConstraints.mustInclude)
                  ? campaignConstraints.mustInclude.filter((value): value is string => typeof value === 'string')
                  : undefined,
                mustAvoid: Array.isArray(campaignConstraints.mustAvoid)
                  ? campaignConstraints.mustAvoid.filter((value): value is string => typeof value === 'string')
                  : undefined,
              },
            },
          })
  const reviewedPlan: GenerationPlan =
    reviewAction ? applyReviewActionToPlan(basePlan, reviewAction as ReviewActionId) : basePlan
  const existingContent = await loadExistingAssetContent(supabase, campaignId, normalizedAssetType)
  const improvementContext = existingContent
    ? buildSurgicalRegenerationContext(
        normalizePlanAssetType(normalizedAssetType),
        evaluateAssetOutput(normalizePlanAssetType(normalizedAssetType), existingContent, reviewedPlan, {
          existingContent,
        }),
        reviewAction,
        existingContent,
      )
    : undefined
  
  try {
    let result: unknown
    let assetData: Record<string, unknown>
    const canonicalDocs: AssetDocument[] = []
    const effectiveBrandId = brandId || resolvedCampaignBrandId || ''
    
    switch (normalizedAssetType) {
      case 'landing': {
        const lpResult = await generateLandingPage({
          brief: `Create a landing page for: ${campaignRecord.name}. 
Target audience: ${campaignRecord.audience || 'general'}. 
Goal: ${campaignRecord.goal || 'conversions'}. 
Offer: ${campaignRecord.offer || campaignRecord.name}.
CTA: ${campaignRecord.cta || 'Get Started'}`,
          workspaceId,
          style: (styleProfile || options.style || { theme: 'dark', layout: 'centered' }) as {
            theme?: 'dark' | 'light' | 'gradient' | 'glass'
            layout?: 'centered' | 'split' | 'grid' | 'asymmetric' | 'stacked'
          },
          brandId: effectiveBrandId || undefined,
          plan: reviewedPlan,
          improvementContext,
        })
        
        result = lpResult
        const design = createWebsiteDesignFromGeneratedPage({
          page: lpResult,
          workspaceId,
          campaign: campaignRecord,
          brandId: effectiveBrandId,
          designId: typeof campaignRecord.landing_design_id === 'string' ? campaignRecord.landing_design_id : undefined,
        })

        await persistCampaignLandingDesign({
          supabase,
          workspaceId,
          campaignId,
          design,
        })

        await supabase.from('page_blocks').delete().eq('campaign_id', campaignId)
        const projectedBlocks = projectDesignToPageBlocks(design, campaignId)
        if (projectedBlocks.length > 0) {
          await supabase.from('page_blocks').insert(projectedBlocks)
        }

        assetData = {
          campaign_id: campaignId,
          workspace_id: workspaceId,
          asset_type: 'landing_page',
          format: 'html',
          content: {
            html: lpResult.html,
            sections: lpResult.sections,
            claims: lpResult.claims,
            websiteSections: design.sections,
            globalStyles: design.globalStyles,
            seoMeta: design.seoMeta,
            designId: design.id,
          },
          html: lpResult.html,
          status: 'draft',
        }
        canonicalDocs.push(
          landingPageToAssetDocument(
            {
              id: crypto.randomUUID(),
              html: lpResult.html,
              headline: campaign.name,
              subheadline: campaign.offer || campaign.goal || '',
              sections: lpResult.sections,
              designTokens: lpResult.designTokens,
              claims: lpResult.claims,
            },
            workspaceId,
            effectiveBrandId,
            campaignId
          )
        )
        break
      }
      
      case 'social': {
        const platforms: Platform[] = channels.length > 0
          ? channels.map((f) => f.toLowerCase() as Platform)
          : formats.length > 0
            ? formats.map((f: string) => f.toLowerCase() as Platform)
          : ['linkedin', 'twitter']
        
        const socialResult = await generateSocialPosts(
          campaignRecord as Parameters<typeof generateSocialPosts>[0],
          workspaceId,
          platforms,
          {
            variants: (typeof options.variants === 'number' ? options.variants : 2),
            includeImagePrompts: true,
            plan: reviewedPlan,
            improvementContext,
          }
        )
        
        result = socialResult
        
        // Save each post as a separate asset
        const assets = []
        for (const post of socialResult.posts) {
          const { data: asset } = await supabase
            .from('campaign_assets')
            .insert({
              campaign_id: campaignId,
              workspace_id: workspaceId,
              asset_type: 'social_post',
              format: post.platform,
              content: post,
              status: 'draft',
            })
            .select()
            .single()
          
          if (asset) assets.push(asset)
          canonicalDocs.push(
            socialPostToAssetDocument(post, workspaceId, effectiveBrandId, campaignId)
          )
        }

        await Promise.all(canonicalDocs.map((doc) => upsertAssetDocument(doc).catch(() => null)))
        
        return NextResponse.json({ 
          assets,
          posts: socialResult.posts,
          count: socialResult.posts.length,
          assetDocuments: canonicalDocs,
          complianceSummary: {
            totalClaims: canonicalDocs.reduce((sum, doc) => sum + doc.claims.length, 0),
            blockedClaims: canonicalDocs.reduce(
              (sum, doc) =>
                sum +
                doc.claims.filter((claim) => claim.riskScore >= 70 && claim.status !== 'verified' && claim.status !== 'overridden').length,
              0
            ),
          },
        }, { status: 201 })
      }
      
      case 'email': {
        const emailResult = await generateEmailSequence(
          campaignRecord as Parameters<typeof generateEmailSequence>[0],
          workspaceId,
          {
            sequenceLength: typeof options.emailCount === 'number' ? options.emailCount : 5,
            plan: reviewedPlan,
            improvementContext,
          }
        )
        
        result = emailResult
        assetData = {
          campaign_id: campaignId,
          workspace_id: workspaceId,
          asset_type: 'email_sequence',
          format: formats[0] || 'nurture',
          content: emailResult,
          status: 'draft',
        }
        canonicalDocs.push(
          ...emailSequenceToAssetDocuments(
            {
              campaignName: emailResult.campaign_name,
              emails: emailResult.emails.map((email) => ({
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
            effectiveBrandId,
            campaignId
          )
        )
        break
      }
      
      case 'deck': {
        const deckResult = await generateSalesDeck(
          campaignRecord as Parameters<typeof generateSalesDeck>[0],
          workspaceId,
          { plan: reviewedPlan, improvementContext }
        )
        
        result = deckResult
        assetData = {
          campaign_id: campaignId,
          workspace_id: workspaceId,
          asset_type: 'deck',
          format: 'slides',
          content: deckResult,
          status: 'draft',
        }
        canonicalDocs.push(
          deckToAssetDocument(
            {
              id: deckResult.id,
              title: deckResult.title,
              slides: deckResult.slides.map((slide) => ({
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
              totalSlides: deckResult.totalSlides,
              estimatedDuration: deckResult.estimatedDuration,
              theme: deckResult.theme,
            },
            workspaceId,
            effectiveBrandId,
            campaignId
          )
        )
        break
      }
      
      case 'video': {
        const format = formats[0] || '16:9'
        const aspectRatio = (format.includes('9:16') ? '9:16' : format.includes('1:1') ? '1:1' : '16:9') as '16:9' | '9:16' | '1:1'
        
        const videoResult = await generateVideoScript(
          campaignRecord as Parameters<typeof generateVideoScript>[0],
          workspaceId,
          aspectRatio,
          {
            duration: options.duration || 30,
            style: options.videoStyle || 'explainer',
          }
        )
        
        result = videoResult
        assetData = {
          campaign_id: campaignId,
          workspace_id: workspaceId,
          asset_type: 'video_script',
          format: aspectRatio,
          content: videoResult,
          status: 'draft',
        }
        break
      }
      
      default:
        return NextResponse.json({ error: `Unknown asset type: ${parsed.data.assetType}` }, { status: 400 })
    }
    
    // Canonical-first persistence
    if (canonicalDocs.length > 0) {
      await Promise.all(canonicalDocs.map((doc) => upsertAssetDocument(doc).catch(() => null)))
    }

    await supabase
      .from('campaigns')
      .update({
        constraints: {
          ...campaignConstraints,
          generation_plan: reviewedPlan,
        },
      })
      .eq('id', campaignId)

    // Legacy mirror is best-effort for backward compatibility
    let asset: Record<string, unknown> | null = null
    try {
      const legacy = await supabase
        .from('campaign_assets')
        .insert(assetData!)
        .select()
        .single()
      asset = (legacy.data as Record<string, unknown> | null) ?? null
    } catch {
      asset = null
    }

    return NextResponse.json({
      asset,
      result,
      assetDocuments: canonicalDocs,
      complianceSummary: {
        totalClaims: canonicalDocs.reduce((sum, doc) => sum + doc.claims.length, 0),
        blockedClaims: canonicalDocs.reduce(
          (sum, doc) =>
            sum +
            doc.claims.filter((claim) => claim.riskScore >= 70 && claim.status !== 'verified' && claim.status !== 'overridden').length,
          0
        ),
      },
    }, { status: 201 })
    
  } catch (error) {
    console.error(`Failed to generate ${parsed.data.assetType}:`, error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Generation failed' },
      { status: 500 }
    )
  }
}

function normalizePlanAssetType(type: 'landing' | 'social' | 'email' | 'deck' | 'video'): 'landing-page' | 'social' | 'email' | 'deck' {
  switch (type) {
    case 'landing':
      return 'landing-page'
    case 'social':
      return 'social'
    case 'email':
      return 'email'
    case 'deck':
    case 'video':
      return 'deck'
  }
}

async function loadExistingAssetContent(
  supabase: ReturnType<typeof createServiceClient>,
  campaignId: string,
  assetType: 'landing' | 'social' | 'email' | 'deck' | 'video',
): Promise<string | null> {
  const dbType =
    assetType === 'landing'
      ? 'landing_page'
      : assetType === 'social'
        ? 'social_post'
        : assetType === 'email'
          ? 'email_sequence'
          : assetType === 'deck'
            ? 'deck'
            : 'video_script'

  const { data } = await supabase
    .from('campaign_assets')
    .select('content, html')
    .eq('campaign_id', campaignId)
    .eq('asset_type', dbType)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!data) {
    return null
  }

  if (typeof data.html === 'string' && data.html.length > 0) {
    return data.html
  }

  if (typeof data.content === 'string') {
    return data.content
  }

  if (data.content && typeof data.content === 'object') {
    return JSON.stringify(data.content)
  }

  return null
}

function normalizeAssetType(type: string): 'landing' | 'social' | 'email' | 'deck' | 'video' {
  switch (type) {
    case 'landing':
    case 'landing_page':
    case 'landing-page':
      return 'landing'
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
      return type as 'landing' | 'social' | 'email' | 'deck' | 'video'
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
