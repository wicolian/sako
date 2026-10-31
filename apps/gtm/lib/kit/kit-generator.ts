/**
 * Launch Kit Generator Orchestrator
 * 
 * Coordinates the parallel generation of all assets in a launch kit:
 * - Landing page
 * - Ad variants (6: 3 angles x 2 platforms)
 * - Email sequence (5 emails)
 * - Social posts (10 across platforms)
 * - Mini deck (6 slides)
 * 
 * Uses existing generators from lib/ai/ and lib/assets/
 */

import { generateLandingPage } from '@/lib/ai/template-aware-generation'
import { generateEmailSequence } from '@/lib/ai/multi-asset'
import { generateSocialPosts } from '@/lib/assets/social-generator'
import { generateSalesDeck } from '@/lib/assets/deck-generator'
import { generateMultiPlatformAds } from '@/lib/assets/ad-generator'
import { generateMarketingAngles } from '@/lib/ai/ai-sdk-client'
import { getBrandContext, getDefaultBrandContext } from '@/lib/ai/brand-context'
import { selectDesignArchetype } from '@/lib/design/archetype-selector'
import { buildGenerationPlan } from '@/lib/planning/generation-plan'
import { validateClaims } from '@/lib/claims/rules-engine'
import { createDefaultPolicyContext } from '@/lib/claims/rules-engine'
import {
  landingPageToAssetDocument,
  socialPostToAssetDocument,
  deckToAssetDocument,
  adVariantToAssetDocument,
  emailSequenceToAssetDocuments,
  upsertAssetDocument,
} from '@/lib/assets/asset-document-adapter'
import type { AssetDocument } from '@/lib/assets/asset-document'
import type { Campaign } from '@/lib/supabase/types'
import type {
  LaunchKit,
  LaunchKitBrief,
  KitGenerationOptions,
  ProgressCallback,
  GenerationProgress,
  LandingPageAsset,
  AdVariant,
  EmailSequence,
  SocialPost,
  DeckAsset,
} from './kit-types'

// ============================================================================
// Main Generator
// ============================================================================

/**
 * Generate a complete launch kit from a brief
 */
export async function generateLaunchKit(
  brief: LaunchKitBrief,
  workspaceId: string,
  options: KitGenerationOptions = {},
  onProgress?: ProgressCallback
): Promise<LaunchKit> {
  const kitId = crypto.randomUUID()
  const startTime = Date.now()
  
  // Report progress helper
  const reportProgress = (step: GenerationProgress['step'], progress: number, message: string) => {
    onProgress?.({ step, progress, message })
  }
  
  try {
    const reviewedPlan =
      brief.planning ??
      options.plan ??
      await buildGenerationPlan({
        workspaceId,
        brandId: brief.brandId || undefined,
        designDirection: options.designDirection,
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

    brief = {
      ...brief,
      planning: reviewedPlan,
    }

    // Step 1: Generate marketing angles
    reportProgress('angles', 5, 'Generating marketing angles...')
    const angles = await generateMarketingAngles(
      {
        name: brief.offer.slice(0, 80),
        audience: brief.audience,
        goal: brief.offer,
        offer: brief.offer,
      },
      undefined,
      3
    )
    const angleTexts = angles.angles.map((a) => a.headline)
    reportProgress('angles', 10, `Generated ${angleTexts.length} marketing angles`)
    
    // Create mock campaign object for existing generators
    const campaign: Campaign = {
      id: kitId,
      name: `Kit: ${brief.offer.slice(0, 50)}`,
      workspace_id: workspaceId,
      brand_id: null,
      status: 'draft',
      audience: brief.audience,
      goal: brief.offer,
      offer: brief.offer,
      cta: brief.cta,
      constraints: null,
      selected_angle_id: null,
      version: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    
    // Step 2: Generate assets in parallel
    reportProgress('landing_page', 15, 'Generating assets...')
    
    const results = await Promise.allSettled([
      // Landing Page
      options.skip?.landingPage 
        ? Promise.resolve(null)
        : generateLandingPageAsset(brief, workspaceId, angleTexts[0], options),
      
      // Ad Variants (6: 3 angles x 2 platforms)
      options.skip?.ads
        ? Promise.resolve([])
        : generateAdVariants(campaign, workspaceId, angleTexts, options.adVariants),
      
      // Email Sequence
      options.skip?.emails
        ? Promise.resolve(null)
        : generateEmailAsset(campaign, workspaceId, options.emailCount, options),
      
      // Social Posts
      options.skip?.social
        ? Promise.resolve([])
        : generateSocialAssets(campaign, workspaceId, options.socialPostCount, options),
      
      // Deck
      options.skip?.deck
        ? Promise.resolve(null)
        : generateDeckAsset(campaign, workspaceId, options.deckSlideCount, options),
    ])
    
    // Update progress for each completed asset
    reportProgress('landing_page', 30, 'Landing page generated')
    reportProgress('ads', 50, 'Ad variants generated')
    reportProgress('emails', 65, 'Email sequence generated')
    reportProgress('social', 80, 'Social posts generated')
    reportProgress('deck', 90, 'Deck generated')
    
    // Extract results with fallbacks
    const landingPage = extractResult<LandingPageAsset>(results[0])
    const ads = extractResult<AdVariant[]>(results[1]) || []
    const emails = extractResult<EmailSequence>(results[2])
    const socialPosts = extractResult<SocialPost[]>(results[3]) || []
    const deck = extractResult<DeckAsset>(results[4])
    
    // Step 3: Extract and validate all claims
    reportProgress('validation', 92, 'Validating compliance...')
    const allClaims = extractAllClaims({ landingPage, ads, emails, socialPosts, deck })
    const compliance = await validateAllClaims(allClaims)
    
    reportProgress('complete', 100, 'Kit generation complete!')
    
    // Assemble the kit
    const kit: LaunchKit = {
      id: kitId,
      campaignId: kitId,
      workspaceId,
      brandId: brief.brandId || undefined,
      brief,
      status: 'review',
      assets: {
        landingPage,
        ads,
        emails,
        socialPosts,
        deck,
      },
      compliance,
      angles: angleTexts,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    
    // Step 4: Persist all assets as canonical AssetDocuments (dual-write)
    reportProgress('complete', 95, 'Persisting asset documents...')
    const brandId = brief.brandId || ''

    try {
      const assetDocs: AssetDocument[] = []

      // Landing page → AssetDocument
      if (landingPage) {
        const doc = landingPageToAssetDocument(landingPage, workspaceId, brandId, kitId)
        await upsertAssetDocument(doc).catch(() => {})
        assetDocs.push(doc)
      }

      // Social posts → AssetDocuments
      for (const post of socialPosts) {
        const doc = socialPostToAssetDocument(post, workspaceId, brandId, kitId)
        await upsertAssetDocument(doc).catch(() => {})
        assetDocs.push(doc)
      }

      // Ads → AssetDocuments
      for (const ad of ads) {
        const doc = adVariantToAssetDocument(ad, workspaceId, brandId, kitId)
        await upsertAssetDocument(doc).catch(() => {})
        assetDocs.push(doc)
      }

      // Emails → AssetDocuments
      if (emails) {
        const docs = emailSequenceToAssetDocuments(emails, workspaceId, brandId, kitId)
        for (const doc of docs) {
          await upsertAssetDocument(doc).catch(() => {})
          assetDocs.push(doc)
        }
      }

      // Deck → AssetDocument
      if (deck) {
        const doc = deckToAssetDocument(deck, workspaceId, brandId, kitId)
        await upsertAssetDocument(doc).catch(() => {})
        assetDocs.push(doc)
      }

      console.log(`Persisted ${assetDocs.length} asset documents`)
    } catch (persistError) {
      // Non-critical: kit still works even if UADM persistence fails
      console.warn('AssetDocument persistence failed (non-blocking):', persistError)
    }

    reportProgress('complete', 100, 'Kit generation complete!')

    console.log(`Kit generated in ${Date.now() - startTime}ms`)
    return kit

  } catch (error) {
    console.error('Kit generation failed:', error)
    throw error
  }
}

// ============================================================================
// Asset Generators
// ============================================================================

async function generateLandingPageAsset(
  brief: LaunchKitBrief,
  workspaceId: string,
  primaryAngle: string,
  options: KitGenerationOptions = {},
): Promise<LandingPageAsset | null> {
  try {
    const brandContext =
      (brief.brandId ? await getBrandContext(workspaceId, brief.brandId) : null) ??
      getDefaultBrandContext()
    const designArchetype = selectDesignArchetype(brandContext, options.designDirection ?? 'auto')
    const result = await generateLandingPage({
      brief: `${primaryAngle}\n\nAudience: ${brief.audience}\nOffer: ${brief.offer}\nCTA: ${brief.cta}`,
      workspaceId,
      brandId: brief.brandId,
      brand: brandContext,
      archetype: designArchetype,
      designDirection: options.designDirection,
      plan: brief.planning ?? options.plan,
    })
    
    return {
      id: crypto.randomUUID(),
      html: result.html,
      headline: extractHeadline(result.html),
      subheadline: extractSubheadline(result.html),
      sections: result.sections,
      designTokens: result.designTokens,
      claims: result.claims || [],
    }
  } catch (error) {
    console.error('Landing page generation failed:', error)
    return null
  }
}

async function generateAdVariants(
  campaign: Campaign,
  workspaceId: string,
  angles: string[],
  variantCount: number = 6
): Promise<AdVariant[]> {
  try {
    // Generate for Instagram and Facebook (2 platforms x 3 angles = 6 variants)
    const platforms: Array<{ platform: 'instagram' | 'facebook'; format: 'feed' | 'story' }> = [
      { platform: 'instagram', format: 'feed' },
      { platform: 'instagram', format: 'story' },
      { platform: 'facebook', format: 'feed' },
    ]
    
    const results = await generateMultiPlatformAds(
      campaign,
      workspaceId,
      platforms,
      { variants: 2 }
    )
    
    return results.map(ad => ({
      id: ad.id,
      angle: angles[Math.floor(Math.random() * angles.length)],
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
  } catch (error) {
    console.error('Ad generation failed:', error)
    return []
  }
}

async function generateEmailAsset(
  campaign: Parameters<typeof generateEmailSequence>[0],
  workspaceId: string,
  emailCount: number = 5,
  options: KitGenerationOptions = {},
): Promise<EmailSequence | null> {
  try {
    const result = await generateEmailSequence(campaign, workspaceId, {
      sequenceLength: emailCount,
      plan: options.plan,
    })
    
    return {
      campaignName: result.campaign_name,
      emails: result.emails.map(email => ({
        subject: email.subject,
        preheader: email.preheader,
        bodyHtml: email.body_html,
        ctaText: email.cta_text,
        ctaUrl: email.cta_url,
        delayDays: email.delay_days,
        emailType: email.email_type,
        claims: [], // TODO: Extract claims from email body
      })),
    }
  } catch (error) {
    console.error('Email generation failed:', error)
    return null
  }
}

async function generateSocialAssets(
  campaign: Parameters<typeof generateSocialPosts>[0],
  workspaceId: string,
  postCount: number = 10,
  options: KitGenerationOptions = {},
): Promise<SocialPost[]> {
  try {
    const brandContext =
      (campaign.brand_id ? await getBrandContext(workspaceId, campaign.brand_id) : null) ??
      getDefaultBrandContext()
    const designArchetype = selectDesignArchetype(brandContext, options.designDirection ?? 'auto')
    const platforms: Array<'linkedin' | 'twitter' | 'facebook' | 'instagram'> = [
      'linkedin',
      'twitter',
      'facebook',
      'instagram',
    ]
    
    const result = await generateSocialPosts(campaign, workspaceId, platforms, {
      variants: Math.ceil(postCount / platforms.length),
      designArchetype,
      plan: options.plan,
    })
    
    return result.posts.slice(0, postCount)
  } catch (error) {
    console.error('Social post generation failed:', error)
    return []
  }
}

async function generateDeckAsset(
  campaign: Parameters<typeof generateSalesDeck>[0],
  workspaceId: string,
  slideCount: number = 6,
  options: KitGenerationOptions = {},
): Promise<DeckAsset | null> {
  try {
    const brandContext =
      (campaign.brand_id ? await getBrandContext(workspaceId, campaign.brand_id) : null) ??
      getDefaultBrandContext()
    const designArchetype = selectDesignArchetype(brandContext, options.designDirection ?? 'auto')
    const result = await generateSalesDeck(campaign, workspaceId, {
      slideCount,
      style: 'minimal',
      designArchetype,
      plan: options.plan,
    })
    
    return {
      id: result.id,
      title: result.title,
      slides: result.slides.map(slide => ({
        id: slide.id,
        type: slide.type as DeckAsset['slides'][0]['type'],
        order: slide.order,
        headline: slide.headline,
        subheadline: slide.subheadline,
        bullets: slide.bullets,
        speakerNotes: slide.speakerNotes,
        visualSuggestion: slide.visualSuggestion,
        claims: slide.claims || [],
      })),
      totalSlides: result.totalSlides,
      estimatedDuration: result.estimatedDuration,
      theme: result.theme,
    }
  } catch (error) {
    console.error('Deck generation failed:', error)
    return null
  }
}

// ============================================================================
// Helpers
// ============================================================================

function extractResult<T>(result: PromiseSettledResult<T | null>): T | null {
  if (result.status === 'fulfilled') {
    return result.value
  }
  console.error('Promise rejected:', result.reason)
  return null
}

function extractHeadline(html: string): string {
  const match = html.match(/<h1[^>]*>(.*?)<\/h1>/i)
  return match ? stripHtml(match[1]) : ''
}

function extractSubheadline(html: string): string {
  const match = html.match(/<h2[^>]*>(.*?)<\/h2>/i) || html.match(/<p[^>]*class="[^"]*subheadline[^"]*"[^>]*>(.*?)<\/p>/i)
  return match ? stripHtml(match[1]) : ''
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim()
}

function extractAllClaims(assets: {
  landingPage: LandingPageAsset | null
  ads: AdVariant[]
  emails: EmailSequence | null
  socialPosts: SocialPost[]
  deck: DeckAsset | null
}): string[] {
  const claims: string[] = []
  
  if (assets.landingPage?.claims) {
    claims.push(...assets.landingPage.claims)
  }
  
  for (const ad of assets.ads) {
    if (ad.claims) claims.push(...ad.claims)
  }
  
  if (assets.emails?.emails) {
    for (const email of assets.emails.emails) {
      if (email.claims) claims.push(...email.claims)
    }
  }
  
  for (const post of assets.socialPosts) {
    if (post.claims) claims.push(...post.claims)
  }
  
  if (assets.deck?.slides) {
    for (const slide of assets.deck.slides) {
      if (slide.claims) claims.push(...slide.claims)
    }
  }
  
  // Deduplicate
  return [...new Set(claims)]
}

async function validateAllClaims(claims: string[]): Promise<{
  totalClaims: number
  approved: number
  needsReview: number
  blocked: number
  averageRiskScore: number
}> {
  const policyContext = createDefaultPolicyContext()
  
  let totalRisk = 0
  let approved = 0
  let needsReview = 0
  let blocked = 0
  
  for (const claim of claims) {
    const result = validateClaims(
      [{ id: crypto.randomUUID(), text: claim }],
      policyContext
    )
    
    const validation = Array.from(result.values())[0]
    totalRisk += validation.riskScore
    
    switch (validation.status) {
      case 'allowed':
        approved++
        break
      case 'needs_proof':
        needsReview++
        break
      case 'blocked':
        blocked++
        break
    }
  }
  
  return {
    totalClaims: claims.length,
    approved,
    needsReview,
    blocked,
    averageRiskScore: claims.length > 0 ? Math.round(totalRisk / claims.length) : 0,
  }
}
