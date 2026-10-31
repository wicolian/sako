import { createServiceClient } from '@/lib/supabase/service'
import { attachCampaignBrandId, resolveCampaignBrandId } from '@/lib/campaigns/brand-link'
import { formatBrandPrompt, getBrandContext, getDefaultBrandContext } from '@/lib/ai/brand-context'
import {
  applyReviewActionToPlan,
  buildGenerationPlan,
  buildPlanPromptContext,
} from '@/lib/planning/generation-plan'
import { GenerationPlanSchema, type GenerationPlan, type ReviewActionId } from '@/lib/planning/types'
import {
  selectDesignArchetype,
  type DesignArchetype,
  type DesignDirection,
} from '@/lib/design/archetype-selector'
import { generateSocialPosts, type Platform } from '@/lib/assets/social-generator'
import { generateSalesDeck } from '@/lib/assets/deck-generator'
import { generateVideoScript } from '@/lib/assets/video-script-generator'
import { generateEmailSequence } from '@/lib/ai/multi-asset'
import { generateLandingPage } from '@/lib/ai/template-aware-generation'
import { generateMultiPlatformAds } from '@/lib/assets/ad-generator'
import {
  adVariantToAssetDocument,
  deckToAssetDocument,
  emailSequenceToAssetDocuments,
  landingPageToAssetDocument,
  socialPostToAssetDocument,
  upsertAssetDocument,
} from '@/lib/assets/asset-document-adapter'
import type { AssetDocument } from '@/lib/assets/asset-document'
import { generateAndPersistCampaignMessages } from '@/lib/ai/generate-campaign-messages'
import { buildBrainPromptContext, getBrainContext, resolveApprovedBrainSnapshot } from '@/lib/brain/service'
import { bindAssetDocumentToBrain } from '@/lib/brain/asset-binding'
import type { BrainContext } from '@/lib/brain/types'
import type { Campaign } from '@/lib/supabase/types'
import type { AdVariant, DeckAsset, EmailSequence, LandingPageAsset, SocialPost } from '@/lib/kit/kit-types'
import { summarizeCompliance, type GeneratedKitAssets } from '@/lib/kit/launch-kit-store'
import {
  createWebsiteDesignFromGeneratedPage,
  persistCampaignLandingDesign,
  projectDesignToPageBlocks,
} from '@/lib/campaigns/landing-design'

export interface ProgressEvent {
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

type GenerationAssetType = 'landing-page' | 'social' | 'email' | 'deck' | 'video' | 'ads'

export interface GenerateCampaignAssetsOptions {
  campaignId: string
  workspaceId: string
  assetTypes: string[]
  formats?: Record<string, string[]>
  validateClaims?: boolean
  useTemplates?: boolean
  designDirection?: DesignDirection
  plan?: GenerationPlan
  reviewAction?: ReviewActionId
  onProgress?: (event: ProgressEvent) => Promise<void> | void
}

export interface GenerateCampaignAssetsResult {
  campaignId: string
  generatedAssets: GeneratedKitAssets & Record<string, unknown>
  assetDocuments: AssetDocument[]
  complianceSummary: {
    totalClaims: number
    approved: number
    needsReview: number
    blocked: number
    averageRiskScore: number
    slopViolations: number
    fabricatedClaims: number
  }
  reviewedPlan: GenerationPlan
}

export class CampaignGenerationError extends Error {
  readonly assetType?: string

  constructor(message: string, assetType?: string) {
    super(message)
    this.name = 'CampaignGenerationError'
    this.assetType = assetType
  }
}

export async function generateCampaignAssets(
  supabase: ReturnType<typeof createServiceClient>,
  campaign: Record<string, unknown>,
  options: GenerateCampaignAssetsOptions,
): Promise<GenerateCampaignAssetsResult> {
  const sendEvent = async (event: ProgressEvent) => {
    await options.onProgress?.(event)
  }

  const campaignRecord = attachCampaignBrandId(campaign)
  const campaignConstraints =
    campaignRecord.constraints && typeof campaignRecord.constraints === 'object' && !Array.isArray(campaignRecord.constraints)
      ? (campaignRecord.constraints as Record<string, unknown>)
      : {}
  const linkedBrandId = resolveCampaignBrandId(campaignRecord)

  if (campaignConstraints.flow === 'url_import' && !linkedBrandId) {
    throw new CampaignGenerationError(
      'Imported campaigns require a saved brand link. Re-run the brand import and create the campaign again.'
    )
  }

  await supabase
    .from('campaigns')
    .update({ status: 'generating' })
    .eq('id', options.campaignId)

  await sendEvent({ step: 'init', progress: 5, status: 'Starting generation...' })

  const normalizedAssetTypes = options.assetTypes.map(normalizeGenerationAssetType)
  const planningAssetTypes = normalizedAssetTypes.filter(isPlanningAssetType)
  const totalAssets = normalizedAssetTypes.length
  const generatedAssets: GeneratedKitAssets & Record<string, unknown> = {}
  const generatedAssetDocuments: AssetDocument[] = []
  const brandId = linkedBrandId
  const brandContext = await getBrandContext(options.workspaceId, brandId)
  const designArchetype = selectDesignArchetype(
    brandContext ?? getDefaultBrandContext(),
    options.designDirection ?? 'auto',
  )
  const approvedSnapshot = await resolveApprovedBrainSnapshot(options.workspaceId, brandId)
  const brainContext = approvedSnapshot
    ? await getBrainContext(options.workspaceId, approvedSnapshot.id)
    : null
  const reviewedPlanInput = GenerationPlanSchema.safeParse(options.plan)
  const storedPlanInput = GenerationPlanSchema.safeParse(campaignConstraints.generation_plan)
  const basePlan =
    reviewedPlanInput.success
      ? reviewedPlanInput.data
      : storedPlanInput.success
        ? storedPlanInput.data
        : await buildGenerationPlan({
            workspaceId: options.workspaceId,
            brandId,
            designDirection: options.designDirection,
            assetTypes: planningAssetTypes,
            brandContext,
            brief: {
              name: campaignRecord.name as string | null,
              audience: campaignRecord.audience as string | null,
              goal: campaignRecord.goal as string | null,
              offer: campaignRecord.offer as string | null,
              cta: campaignRecord.cta as string | null,
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
    options.reviewAction ? applyReviewActionToPlan(basePlan, options.reviewAction) : basePlan
  const generationContext = await buildGenerationContextPrompt(
    supabase,
    options.workspaceId,
    brandId,
    brainContext,
    reviewedPlan,
  )

  await supabase
    .from('campaigns')
    .update({
      brain_snapshot_id: approvedSnapshot?.id ?? null,
      constraints: {
        ...(((campaignRecord.constraints as Record<string, unknown> | null) ?? {})),
        generation_mode: approvedSnapshot ? 'gtm_brain' : 'brand_fallback',
        brain_snapshot_id: approvedSnapshot?.id ?? null,
        design_archetype: designArchetype,
        design_direction: options.designDirection ?? 'auto',
        generation_plan: reviewedPlan,
      },
    })
    .eq('id', options.campaignId)

  for (let index = 0; index < normalizedAssetTypes.length; index += 1) {
    const assetType = normalizedAssetTypes[index]
    const assetFormats = options.formats?.[assetType] || []
    const baseProgress = 5 + (index / totalAssets) * 80

    await sendEvent({
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
            campaignRecord,
            options.workspaceId,
            supabase,
            options.campaignId,
            options.useTemplates ?? true,
            generationContext,
            brainContext,
            brandContext,
            designArchetype,
            options.designDirection ?? 'auto',
            reviewedPlan,
          )
          generatedAssets.landingPage = result as NonNullable<GeneratedKitAssets['landingPage']>
          break
        case 'social':
          result = await generateSocialAsset(
            campaignRecord,
            options.workspaceId,
            supabase,
            options.campaignId,
            assetFormats as Platform[],
            generationContext,
            brainContext,
            designArchetype,
            options.designDirection ?? 'auto',
            reviewedPlan,
          )
          generatedAssets.social = result as NonNullable<GeneratedKitAssets['social']>
          break
        case 'email':
          result = await generateEmailAsset(
            campaignRecord,
            options.workspaceId,
            supabase,
            options.campaignId,
            assetFormats,
            generationContext,
            brainContext,
            brandContext,
            designArchetype,
            options.designDirection ?? 'auto',
            reviewedPlan,
          )
          generatedAssets.emails = result as NonNullable<GeneratedKitAssets['emails']>
          break
        case 'deck':
          result = await generateDeckAsset(
            campaignRecord,
            options.workspaceId,
            supabase,
            options.campaignId,
            generationContext,
            brainContext,
            designArchetype,
            options.designDirection ?? 'auto',
            reviewedPlan,
          )
          generatedAssets.deck = result as NonNullable<GeneratedKitAssets['deck']>
          break
        case 'video':
          result = await generateVideoAsset(
            campaignRecord,
            options.workspaceId,
            supabase,
            options.campaignId,
            assetFormats,
          )
          break
        case 'ads':
          result = await generateAdsAsset(
            campaignRecord,
            options.workspaceId,
            supabase,
            options.campaignId,
            brainContext,
          )
          generatedAssets.ads = result as NonNullable<GeneratedKitAssets['ads']>
          break
        default:
          throw new CampaignGenerationError(`Unknown asset type: ${assetType}`, assetType)
      }

      const docs = (result as { assetDocuments?: AssetDocument[] }).assetDocuments
      if (docs?.length) {
        generatedAssetDocuments.push(...docs)
      }

      await sendEvent({
        step: 'asset_complete',
        progress: Math.round(baseProgress + 80 / totalAssets),
        status: `${formatAssetName(assetType)} complete`,
        assetType,
        result: { success: true, assetId: (result as { id?: string; assetId?: string })?.id ?? (result as { assetId?: string }).assetId },
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      await supabase
        .from('campaigns')
        .update({ status: 'failed' })
        .eq('id', options.campaignId)

      await sendEvent({
        step: 'asset_error',
        progress: Math.round(baseProgress),
        status: `Error generating ${formatAssetName(assetType)}`,
        assetType,
        error: message,
      })

      throw new CampaignGenerationError(`Failed to generate ${formatAssetName(assetType)}: ${message}`, assetType)
    }
  }

  try {
    await sendEvent({ step: 'messages', progress: 88, status: 'Generating key messages...' })
    await generateAndPersistCampaignMessages(options.campaignId, supabase)
  } catch (error) {
    console.warn('[campaigns/generate] key message generation failed:', error)
  }

  if (options.validateClaims ?? true) {
    await sendEvent({ step: 'validating', progress: 94, status: 'Validating claims...' })
  }

  const compliance = summarizeCompliance(generatedAssetDocuments)
  const complianceSummary = {
    ...compliance,
    slopViolations: generatedAssetDocuments.reduce(
      (sum, doc) => sum + doc.claims.filter((claim) => claim.text.startsWith('Slop detector:')).length,
      0,
    ),
    fabricatedClaims: generatedAssetDocuments.reduce(
      (sum, doc) =>
        sum + doc.claims.filter((claim) => claim.suggestedRewrite?.includes('AI-generated claim')).length,
      0,
    ),
  }

  await supabase
    .from('campaigns')
    .update({ status: 'ready' })
    .eq('id', options.campaignId)

  await sendEvent({
    step: 'complete',
    progress: 100,
    status: 'Generation complete!',
    result: {
      campaignId: options.campaignId,
      generatedAssets: Object.keys(generatedAssets),
      assetDocuments: generatedAssetDocuments,
      complianceSummary,
    },
  })

  return {
    campaignId: options.campaignId,
    generatedAssets,
    assetDocuments: generatedAssetDocuments,
    complianceSummary,
    reviewedPlan,
  }
}

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

  const design = createWebsiteDesignFromGeneratedPage({
    page: result,
    workspaceId,
    campaign,
    brandId,
    designId: typeof campaign.landing_design_id === 'string' ? campaign.landing_design_id : undefined,
  })

  await persistCampaignLandingDesign({
    supabase,
    workspaceId,
    campaignId,
    design,
  })

  const blocks = projectDesignToPageBlocks(design, campaignId)
  await supabase.from('page_blocks').delete().eq('campaign_id', campaignId)
  if (blocks.length > 0) {
    await supabase.from('page_blocks').insert(blocks)
  }

  const landingPageAsset: LandingPageAsset = {
    id: crypto.randomUUID(),
    html: result.html,
    headline: (campaign.name as string) ?? 'Landing Page',
    subheadline: (campaign.offer as string) ?? '',
    sections: result.sections,
    designTokens: result.designTokens,
    claims: result.claims,
  }

  const doc = attachBrainContext(
    landingPageToAssetDocument(landingPageAsset, workspaceId, brandId, campaignId),
    brainContext,
  )
  await upsertAssetDocument(doc).catch(() => null)

  const legacyAssetId = await insertLegacyCampaignAsset(supabase, {
    campaign_id: campaignId,
    workspace_id: workspaceId,
    asset_type: 'landing_page',
    format: 'html',
    content: {
      html: result.html,
      sections: result.sections,
      websiteSections: design.sections,
      globalStyles: design.globalStyles,
      seoMeta: design.seoMeta,
      designId: design.id,
    },
    html: result.html,
    status: 'draft',
  })

  return { ...landingPageAsset, legacyAssetId, assetDocuments: [doc] }
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
  const selectedPlatforms: Platform[] = platforms.length > 0 ? platforms : ['linkedin', 'twitter']

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
    },
  )

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
    if (legacyAssetId) {
      legacyAssets.push(legacyAssetId)
    }
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
    },
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
    },
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

  const deck: DeckAsset = {
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
  }

  const doc = attachBrainContext(
    deckToAssetDocument(deck, workspaceId, brandId, campaignId, {
      designArchetype: designArchetype ?? undefined,
    }),
    brainContext,
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

  return { ...deck, legacyAssetId, assetDocuments: [doc] }
}

async function generateVideoAsset(
  campaign: Record<string, unknown>,
  workspaceId: string,
  supabase: ReturnType<typeof createServiceClient>,
  campaignId: string,
  formats: string[],
) {
  const format = formats[0] || '16:9'
  const aspectRatio = (format.includes('9:16') ? '9:16' : format.includes('1:1') ? '1:1' : '16:9') as '16:9' | '9:16' | '1:1'

  const result = await generateVideoScript(campaign as Parameters<typeof generateVideoScript>[0], workspaceId, aspectRatio, {
    duration: 30,
    style: 'explainer',
  })

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
    .single()

  return { assetId: asset?.id, ...result }
}

async function generateAdsAsset(
  campaign: Record<string, unknown>,
  workspaceId: string,
  supabase: ReturnType<typeof createServiceClient>,
  campaignId: string,
  brainContext?: BrainContext | null,
) {
  const brandId = (campaign.brand_id as string | undefined) ?? ''
  const results = await generateMultiPlatformAds(
    campaign as Campaign,
    workspaceId,
    [
      { platform: 'instagram', format: 'feed' },
      { platform: 'instagram', format: 'story' },
      { platform: 'facebook', format: 'feed' },
    ],
    { variants: 2 },
  )

  const variants: AdVariant[] = results.map((ad) => ({
    id: ad.id,
    angle: ad.headline || (campaign.offer as string) || (campaign.name as string) || 'Primary angle',
    platform: ad.platform as AdVariant['platform'],
    format: ad.format as AdVariant['format'],
    primaryText: ad.primaryText,
    headline: ad.headline || '',
    description: ad.description,
    callToAction: ad.callToAction,
    imagePrompt: ad.imagePrompts?.[0] || '',
    dimensions: ad.dimensions,
    claims: ad.claims || [],
  }))

  const assetDocuments: AssetDocument[] = []
  for (const variant of variants) {
    const doc = attachBrainContext(
      adVariantToAssetDocument(variant, workspaceId, brandId, campaignId),
      brainContext,
    )
    await upsertAssetDocument(doc).catch(() => null)
    assetDocuments.push(doc)

    await insertLegacyCampaignAsset(supabase, {
      campaign_id: campaignId,
      workspace_id: workspaceId,
      asset_type: 'ad_variant',
      format: variant.platform,
      content: variant,
      status: 'draft',
    })
  }

  return { id: assetDocuments[0]?.id, variants, assetDocuments }
}

function formatAssetName(assetType: string): string {
  const names: Record<string, string> = {
    'landing-page': 'Landing Page',
    social: 'Social Posts',
    email: 'Email Sequence',
    deck: 'Sales Deck',
    video: 'Video Script',
    ads: 'Ads',
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
    case 'ads':
    case 'ad':
      return 'ads'
    default:
      return assetType as GenerationAssetType
  }
}

function isPlanningAssetType(
  assetType: GenerationAssetType,
): assetType is 'landing-page' | 'email' | 'social' | 'deck' {
  return assetType === 'landing-page' || assetType === 'email' || assetType === 'social' || assetType === 'deck'
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
  },
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

function mapDeckSlideType(type: string): DeckAsset['slides'][number]['type'] {
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
