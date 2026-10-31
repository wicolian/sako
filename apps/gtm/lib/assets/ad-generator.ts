/**
 * Platform-Specific Ad Generator (Holo-style)
 * 
 * Generates ads optimized for specific platforms and formats:
 * - Instagram Story Ads
 * - Instagram Reels Ads
 * - Facebook Carousel Ads
 * - TikTok Video Scripts
 * 
 * Each format has its own structure, dimensions, and best practices.
 */

import { generateObject } from '@/lib/ai/langsmith-ai'
import { z } from 'zod'
import { MODELS } from '@/lib/ai/ai-sdk-client'
import { detectAdjectiveStacks, detectSlop, extractNewClaims } from '@/lib/ai/anti-slop'
import { getBrandContext, formatBrandPrompt, type BrandContext } from '@/lib/ai/brand-context'
import { buildCopywriterPrompt } from '@/lib/ai/prompts-v2'
import { IDEA_ARCHETYPES, type IdeaArchetype } from '@/lib/ai/idea-archetypes'
import type { Campaign } from '@/lib/supabase/types'

// ============================================================================
// Types
// ============================================================================

export type AdPlatform = 'instagram' | 'facebook' | 'tiktok'
export type AdFormat = 'story' | 'reels' | 'carousel' | 'feed' | 'video'

export interface AdCreative {
  id: string
  platform: AdPlatform
  format: AdFormat
  primaryText: string
  headline?: string
  description?: string
  callToAction: string
  imagePrompts: string[]
  dimensions: { width: number; height: number }
  duration?: number // seconds for video
  claims: string[]
  archetype?: string
  variantLabel: string
}

export interface InstagramStoryAd extends AdCreative {
  format: 'story'
  slides: Array<{
    imagePrompt: string
    textOverlay: string
    position: 'top' | 'center' | 'bottom'
    ctaSlide: boolean
  }>
  swipeUpCta: string
}

export interface InstagramReelsAd extends AdCreative {
  format: 'reels'
  hook: string
  script: Array<{
    timestamp: string
    visual: string
    audio: string
    textOverlay?: string
  }>
  trendingAudioSuggestion?: string
  hashtags: string[]
}

export interface FacebookCarouselAd extends AdCreative {
  format: 'carousel'
  cards: Array<{
    headline: string
    description: string
    imagePrompt: string
    linkUrl?: string
  }>
  endCard: {
    headline: string
    description: string
    ctaButton: string
  }
}

export interface TikTokVideoAd extends AdCreative {
  format: 'video'
  hook: string
  script: Array<{
    timestamp: string
    visual: string
    voiceover: string
    onScreenText?: string
    bRoll?: string
  }>
  trendingSound?: string
  hashtags: string[]
  duration: number
}

export interface AdGeneratorOptions {
  variants?: number
  archetype?: string
  tone?: 'professional' | 'casual' | 'energetic' | 'authentic'
  includeImagePrompts?: boolean
}

// ============================================================================
// Instagram Story Ad Generator
// ============================================================================

const InstagramStorySchema = z.object({
  primaryText: z.string().describe('Main ad copy (125 chars max)'),
  slides: z.array(z.object({
    imagePrompt: z.string().describe('AI image generation prompt for this slide'),
    textOverlay: z.string().describe('Text shown on the slide (short, punchy)'),
    position: z.enum(['top', 'center', 'bottom']).describe('Text position'),
    ctaSlide: z.boolean().describe('Is this the CTA slide?'),
  })).describe('3-5 slides for the story ad'),
  swipeUpCta: z.string().describe('Swipe up call to action text'),
  callToAction: z.string().describe('Button CTA text'),
  claims: z.array(z.string()).describe('Marketing claims made'),
})

const InstagramStoryBatchSchema = z.object({
  ads: z.array(InstagramStorySchema),
})

type InstagramStoryBatch = z.infer<typeof InstagramStoryBatchSchema>

export async function generateInstagramStoryAd(
  campaign: Campaign,
  workspaceId: string,
  options: AdGeneratorOptions = {}
): Promise<InstagramStoryAd[]> {
  const brandContext = await getBrandContext(workspaceId)
  const variants = options.variants || 2
  const variantLabels = ['A', 'B', 'C', 'D', 'E'].slice(0, variants)

  const archetypeGuidance = options.archetype
    ? getArchetypeGuidance(options.archetype)
    : ''

  const { object } = await generateObject({
    model: MODELS.CREATIVE,
    schema: InstagramStoryBatchSchema,
    system: buildCopywriterPrompt({
      audience: campaign.audience || 'general',
      brandVoice: brandContext ? formatBrandPrompt(brandContext) : undefined,
    }),
    prompt: `Generate ${variants} Instagram Story ad variant(s) for this campaign.

CAMPAIGN:
- Name: ${campaign.name}
- Audience: ${campaign.audience || 'general'}
- Goal: ${campaign.goal || 'awareness'}
- Key Message: ${campaign.offer || campaign.name}
- CTA: ${campaign.cta || 'Learn more'}

BRAND:
- Voice: ${brandContext?.voice?.tone || 'professional'}
- Primary Color: ${brandContext?.colors?.primary || '#000000'}

${archetypeGuidance}

INSTAGRAM STORY AD REQUIREMENTS:
- 9:16 aspect ratio (1080x1920)
- 3-5 slides that tell a story
- First slide must hook attention in 1 second
- Each slide should have minimal text (max 2 lines)
- Last slide should be the CTA
- Swipe up CTA must be compelling
- Total duration: 15 seconds max

TONE: ${options.tone || 'energetic'}

Generate ${variants} unique variants that are different enough to A/B test.`,
  })

  const typed = object as InstagramStoryBatch

  return typed.ads.map((ad, idx) => ({
    id: `ig-story-${variantLabels[idx]}-${Date.now()}`,
    platform: 'instagram' as const,
    format: 'story' as const,
    primaryText: ad.primaryText,
    callToAction: ad.callToAction,
    imagePrompts: ad.slides.map(s => s.imagePrompt),
    dimensions: { width: 1080, height: 1920 },
    claims: collectAdClaims([
      ad.primaryText,
      ad.callToAction,
      ad.swipeUpCta,
      ...ad.slides.map((slide) => slide.textOverlay),
      ...ad.claims,
    ], brandContext),
    archetype: options.archetype,
    variantLabel: variantLabels[idx],
    slides: ad.slides,
    swipeUpCta: ad.swipeUpCta,
  }))
}

// ============================================================================
// Instagram Reels Ad Generator
// ============================================================================

const InstagramReelsSchema = z.object({
  hook: z.string().describe('Opening hook (first 3 seconds)'),
  primaryText: z.string().describe('Ad copy for the post'),
  script: z.array(z.object({
    timestamp: z.string().describe('Timestamp (e.g., "0:00-0:03")'),
    visual: z.string().describe('What appears on screen'),
    audio: z.string().describe('Voiceover or sound'),
    textOverlay: z.string().optional().describe('On-screen text'),
  })).describe('Scene-by-scene breakdown'),
  trendingAudioSuggestion: z.string().optional().describe('Trending audio suggestion'),
  hashtags: z.array(z.string()).describe('Relevant hashtags'),
  callToAction: z.string().describe('CTA text'),
  claims: z.array(z.string()).describe('Marketing claims made'),
})

const InstagramReelsBatchSchema = z.object({
  ads: z.array(InstagramReelsSchema),
})

type InstagramReelsBatch = z.infer<typeof InstagramReelsBatchSchema>

export async function generateInstagramReelsAd(
  campaign: Campaign,
  workspaceId: string,
  options: AdGeneratorOptions = {}
): Promise<InstagramReelsAd[]> {
  const brandContext = await getBrandContext(workspaceId)
  const variants = options.variants || 2
  const variantLabels = ['A', 'B', 'C', 'D', 'E'].slice(0, variants)

  const archetypeGuidance = options.archetype
    ? getArchetypeGuidance(options.archetype)
    : ''

  const { object } = await generateObject({
    model: MODELS.CREATIVE,
    schema: InstagramReelsBatchSchema,
    system: buildCopywriterPrompt({
      audience: campaign.audience || 'general',
      brandVoice: brandContext ? formatBrandPrompt(brandContext) : undefined,
    }),
    prompt: `Generate ${variants} Instagram Reels ad variant(s) for this campaign.

CAMPAIGN:
- Name: ${campaign.name}
- Audience: ${campaign.audience || 'general'}
- Goal: ${campaign.goal || 'conversions'}
- Key Message: ${campaign.offer || campaign.name}
- CTA: ${campaign.cta || 'Shop now'}

BRAND:
- Voice: ${brandContext?.voice?.tone || 'energetic'}

${archetypeGuidance}

INSTAGRAM REELS AD REQUIREMENTS:
- 9:16 aspect ratio (1080x1920)
- Duration: 15-30 seconds (aim for 15-20)
- Hook in first 3 seconds is CRITICAL
- Fast-paced, visually engaging
- Native feel (not overly polished)
- Trending audio increases reach
- End with clear CTA
- 3-5 relevant hashtags

TONE: ${options.tone || 'authentic'}

Generate ${variants} unique variants optimized for engagement.`,
  })

  const typed = object as InstagramReelsBatch

  return typed.ads.map((ad, idx) => ({
    id: `ig-reels-${variantLabels[idx]}-${Date.now()}`,
    platform: 'instagram' as const,
    format: 'reels' as const,
    hook: ad.hook,
    primaryText: ad.primaryText,
    callToAction: ad.callToAction,
    imagePrompts: ad.script.map(s => s.visual),
    dimensions: { width: 1080, height: 1920 },
    duration: 20,
    claims: collectAdClaims([
      ad.hook,
      ad.primaryText,
      ad.callToAction,
      ...ad.script.map((scene) => `${scene.audio} ${scene.textOverlay || ''}`),
      ...ad.claims,
    ], brandContext),
    archetype: options.archetype,
    variantLabel: variantLabels[idx],
    script: ad.script,
    trendingAudioSuggestion: ad.trendingAudioSuggestion,
    hashtags: ad.hashtags,
  }))
}

// ============================================================================
// Facebook Carousel Ad Generator
// ============================================================================

const FacebookCarouselSchema = z.object({
  primaryText: z.string().describe('Main post text (125 chars recommended)'),
  cards: z.array(z.object({
    headline: z.string().describe('Card headline (40 chars max)'),
    description: z.string().describe('Card description (20 chars max)'),
    imagePrompt: z.string().describe('AI image generation prompt'),
  })).describe('3-10 carousel cards'),
  endCard: z.object({
    headline: z.string().describe('Final CTA card headline'),
    description: z.string().describe('Final CTA card description'),
    ctaButton: z.string().describe('CTA button text'),
  }),
  callToAction: z.string().describe('Overall CTA'),
  claims: z.array(z.string()).describe('Marketing claims made'),
})

const FacebookCarouselBatchSchema = z.object({
  ads: z.array(FacebookCarouselSchema),
})

type FacebookCarouselBatch = z.infer<typeof FacebookCarouselBatchSchema>

export async function generateFacebookCarouselAd(
  campaign: Campaign,
  workspaceId: string,
  options: AdGeneratorOptions = {}
): Promise<FacebookCarouselAd[]> {
  const brandContext = await getBrandContext(workspaceId)
  const variants = options.variants || 2
  const variantLabels = ['A', 'B', 'C', 'D', 'E'].slice(0, variants)

  const archetypeGuidance = options.archetype
    ? getArchetypeGuidance(options.archetype)
    : ''

  const { object } = await generateObject({
    model: MODELS.CREATIVE,
    schema: FacebookCarouselBatchSchema,
    system: buildCopywriterPrompt({
      audience: campaign.audience || 'general',
      brandVoice: brandContext ? formatBrandPrompt(brandContext) : undefined,
    }),
    prompt: `Generate ${variants} Facebook Carousel ad variant(s) for this campaign.

CAMPAIGN:
- Name: ${campaign.name}
- Audience: ${campaign.audience || 'general'}
- Goal: ${campaign.goal || 'conversions'}
- Key Message: ${campaign.offer || campaign.name}
- CTA: ${campaign.cta || 'Learn more'}

BRAND:
- Voice: ${brandContext?.voice?.tone || 'professional'}
- Primary Color: ${brandContext?.colors?.primary || '#000000'}

${archetypeGuidance}

FACEBOOK CAROUSEL AD REQUIREMENTS:
- Image ratio: 1:1 (1080x1080)
- 3-5 cards (can go up to 10)
- Each card should tell part of a story
- Headlines: 40 characters max
- Descriptions: 20 characters max
- Primary text: 125 characters recommended (up to 500)
- First card must grab attention
- Last card should be strong CTA
- Cards should flow logically

TONE: ${options.tone || 'professional'}

CAROUSEL STORY STRUCTURES:
- Problem → Solution → Benefits → Features → CTA
- Feature 1 → Feature 2 → Feature 3 → Social Proof → CTA
- Before → After → How → Testimonial → CTA

Generate ${variants} unique carousel structures.`,
  })

  const typed = object as FacebookCarouselBatch

  return typed.ads.map((ad, idx) => ({
    id: `fb-carousel-${variantLabels[idx]}-${Date.now()}`,
    platform: 'facebook' as const,
    format: 'carousel' as const,
    primaryText: ad.primaryText,
    callToAction: ad.callToAction,
    imagePrompts: ad.cards.map(c => c.imagePrompt),
    dimensions: { width: 1080, height: 1080 },
    claims: collectAdClaims([
      ad.primaryText,
      ad.callToAction,
      ad.endCard.headline,
      ad.endCard.description,
      ...ad.cards.flatMap((card) => [card.headline, card.description]),
      ...ad.claims,
    ], brandContext),
    archetype: options.archetype,
    variantLabel: variantLabels[idx],
    cards: ad.cards,
    endCard: ad.endCard,
  }))
}

// ============================================================================
// TikTok Video Ad Generator
// ============================================================================

const TikTokVideoSchema = z.object({
  hook: z.string().describe('Opening hook (first 2-3 seconds) - CRITICAL'),
  primaryText: z.string().describe('Video caption'),
  script: z.array(z.object({
    timestamp: z.string().describe('Timestamp'),
    visual: z.string().describe('What shows on screen'),
    voiceover: z.string().describe('What is said'),
    onScreenText: z.string().optional().describe('Text overlay'),
    bRoll: z.string().optional().describe('B-roll suggestion'),
  })).describe('Scene breakdown'),
  trendingSound: z.string().optional().describe('Trending sound suggestion'),
  hashtags: z.array(z.string()).describe('Hashtags (3-5)'),
  callToAction: z.string().describe('CTA'),
  claims: z.array(z.string()).describe('Marketing claims'),
})

const TikTokVideoBatchSchema = z.object({
  ads: z.array(TikTokVideoSchema),
})

type TikTokVideoBatch = z.infer<typeof TikTokVideoBatchSchema>

export async function generateTikTokVideoAd(
  campaign: Campaign,
  workspaceId: string,
  options: AdGeneratorOptions = {}
): Promise<TikTokVideoAd[]> {
  const brandContext = await getBrandContext(workspaceId)
  const variants = options.variants || 2
  const variantLabels = ['A', 'B', 'C', 'D', 'E'].slice(0, variants)

  const archetypeGuidance = options.archetype
    ? getArchetypeGuidance(options.archetype)
    : ''

  const { object } = await generateObject({
    model: MODELS.CREATIVE,
    schema: TikTokVideoBatchSchema,
    system: buildCopywriterPrompt({
      audience: campaign.audience || 'gen-z/millennials',
      brandVoice: brandContext ? formatBrandPrompt(brandContext) : undefined,
    }),
    prompt: `Generate ${variants} TikTok video ad variant(s) for this campaign.

CAMPAIGN:
- Name: ${campaign.name}
- Audience: ${campaign.audience || 'gen-z/millennials'}
- Goal: ${campaign.goal || 'awareness'}
- Key Message: ${campaign.offer || campaign.name}
- CTA: ${campaign.cta || 'Link in bio'}

BRAND:
- Voice: ${brandContext?.voice?.tone || 'authentic'}

${archetypeGuidance}

TIKTOK VIDEO AD REQUIREMENTS:
- 9:16 aspect ratio (1080x1920)
- Duration: 15-60 seconds (aim for 15-30)
- Hook in first 2-3 seconds is EVERYTHING
- Native, authentic feel (not polished ads)
- Face-to-camera or POV style works best
- Fast cuts and transitions
- Trending sounds boost reach
- Text overlays for silent viewers
- End with clear CTA

VIRAL TIKTOK HOOKS:
- "Here's something nobody tells you about..."
- "I tested [X] so you don't have to..."
- "POV: You just discovered..."
- "The secret to [X] that nobody talks about"
- "Stop scrolling if you [pain point]"

TONE: ${options.tone || 'authentic'}

Generate ${variants} unique variants with different hooks and angles.`,
  })

  const typed = object as TikTokVideoBatch

  return typed.ads.map((ad, idx) => ({
    id: `tiktok-video-${variantLabels[idx]}-${Date.now()}`,
    platform: 'tiktok' as const,
    format: 'video' as const,
    hook: ad.hook,
    primaryText: ad.primaryText,
    callToAction: ad.callToAction,
    imagePrompts: ad.script.map(s => s.visual),
    dimensions: { width: 1080, height: 1920 },
    duration: 20,
    claims: collectAdClaims([
      ad.hook,
      ad.primaryText,
      ad.callToAction,
      ...ad.script.map((scene) => `${scene.voiceover} ${scene.onScreenText || ''}`),
      ...ad.claims,
    ], brandContext),
    archetype: options.archetype,
    variantLabel: variantLabels[idx],
    script: ad.script,
    trendingSound: ad.trendingSound,
    hashtags: ad.hashtags,
  }))
}

// ============================================================================
// Helpers
// ============================================================================

function getArchetypeGuidance(archetypeId: string): string {
  const archetype = IDEA_ARCHETYPES.find(a => a.id === archetypeId)
  if (!archetype) return ''

  return `
CONTENT ARCHETYPE: ${archetype.name}
${archetype.description}

Guidelines:
${archetype.prompt}

Example Hook Style: "${archetype.exampleHook}"
Emotional Trigger: ${archetype.emotionalTrigger}
`
}

function collectAdClaims(parts: string[], brandContext: BrandContext | null): string[] {
  const text = parts.filter(Boolean).join('\n')
  return [
    ...new Set([
      ...extractNewClaims(text),
      ...detectSlop(text, brandContext?.messaging.valuePropositions).map((violation) => `slop:${violation.phrase}`),
      ...detectAdjectiveStacks(text).map((stack) => `adjective_stack:${stack}`),
      ...parts.filter((part) => /^\[NEW_CLAIM\]/.test(part)),
    ]),
  ]
}

/**
 * Generate ads for multiple platforms at once
 */
export async function generateMultiPlatformAds(
  campaign: Campaign,
  workspaceId: string,
  platforms: Array<{ platform: AdPlatform; format: AdFormat }>,
  options: AdGeneratorOptions = {}
): Promise<AdCreative[]> {
  const results: AdCreative[] = []

  for (const { platform, format } of platforms) {
    let ads: AdCreative[] = []

    if (platform === 'instagram' && format === 'story') {
      ads = await generateInstagramStoryAd(campaign, workspaceId, options)
    } else if (platform === 'instagram' && format === 'reels') {
      ads = await generateInstagramReelsAd(campaign, workspaceId, options)
    } else if (platform === 'facebook' && format === 'carousel') {
      ads = await generateFacebookCarouselAd(campaign, workspaceId, options)
    } else if (platform === 'tiktok' && format === 'video') {
      ads = await generateTikTokVideoAd(campaign, workspaceId, options)
    }

    results.push(...ads)
  }

  return results
}

/**
 * Get supported formats for a platform
 */
export function getSupportedFormats(platform: AdPlatform): AdFormat[] {
  switch (platform) {
    case 'instagram':
      return ['story', 'reels', 'feed', 'carousel']
    case 'facebook':
      return ['feed', 'carousel', 'story', 'video']
    case 'tiktok':
      return ['video']
    default:
      return []
  }
}

/**
 * Get ad dimensions for a format
 */
export function getAdDimensions(
  platform: AdPlatform,
  format: AdFormat
): { width: number; height: number; label: string } {
  if (format === 'story' || format === 'reels' || (platform === 'tiktok' && format === 'video')) {
    return { width: 1080, height: 1920, label: '9:16 Vertical' }
  }
  if (format === 'carousel' || format === 'feed') {
    return { width: 1080, height: 1080, label: '1:1 Square' }
  }
  return { width: 1200, height: 628, label: '1.91:1 Landscape' }
}
