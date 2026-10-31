/**
 * Influencer/UGC Content Generator
 * 
 * Generate influencer-style videos, reels, carousels, and stories
 * with authentic UGC aesthetics.
 */

import { generateText, generateObject } from '@/lib/ai/langsmith-ai'
import { MODELS } from '@/lib/ai/ai-sdk-client'
import { z } from 'zod'

export type UGCFormat = 
  | 'talking_head'
  | 'product_review'
  | 'day_in_life'
  | 'before_after'
  | 'unboxing'
  | 'trend_jacking'
  | 'story_series'
  | 'carousel'

export type UGCStyle =
  | 'authentic'
  | 'polished'
  | 'raw'
  | 'aesthetic'
  | 'comedic'
  | 'educational'

export interface UGCGenerationInput {
  productName: string
  productDescription: string
  targetAudience: string
  format: UGCFormat
  style: UGCStyle
  platform: 'tiktok' | 'instagram_reels' | 'instagram_stories' | 'youtube_shorts'
  duration?: number // seconds
  brandVoice?: string
  keyMessages?: string[]
  trendToJack?: string
}

export interface TalkingHeadScript {
  hook: string // First 1-3 seconds
  problem: string
  solution: string
  proof: string
  cta: string
  visualCues: string[]
  timing: {
    section: string
    startTime: number
    endTime: number
    text: string
  }[]
}

export interface ProductReviewScript {
  opener: string
  firstImpression: string
  features: Array<{
    feature: string
    reaction: string
    visual: string
  }>
  pros: string[]
  cons: string[]
  verdict: string
  rating: string
  cta: string
}

export interface BeforeAfterScript {
  beforeSetup: string
  beforeVisual: string
  transitionHook: string
  afterReveal: string
  afterVisual: string
  keyDifferences: string[]
  socialProof: string
  cta: string
}

export interface UnboxingScript {
  teaser: string
  packageReaction: string
  unboxingMoments: Array<{
    item: string
    reaction: string
    visual: string
  }>
  firstUse: string
  verdict: string
  cta: string
}

export interface CarouselContent {
  slides: Array<{
    slideNumber: number
    headline: string
    body: string
    visualDescription: string
    ctaText?: string
  }>
  caption: string
  hashtags: string[]
}

export interface StorySeriesContent {
  stories: Array<{
    storyNumber: number
    duration: number
    textOverlay: string
    visualDescription: string
    pollOrSticker?: string
    swipeUpCta?: string
  }>
  overallNarrative: string
}

export interface UGCGenerationResult {
  format: UGCFormat
  platform: string
  script: TalkingHeadScript | ProductReviewScript | BeforeAfterScript | UnboxingScript | CarouselContent | StorySeriesContent
  hooks: string[]
  hashtags: string[]
  soundSuggestions: string[]
  postingTips: string[]
  estimatedDuration: number
}

const formatSchemas = {
  talking_head: z.object({
    hook: z.string(),
    problem: z.string(),
    solution: z.string(),
    proof: z.string(),
    cta: z.string(),
    visualCues: z.array(z.string()),
    timing: z.array(z.object({
      section: z.string(),
      startTime: z.number(),
      endTime: z.number(),
      text: z.string(),
    })),
  }),
  product_review: z.object({
    opener: z.string(),
    firstImpression: z.string(),
    features: z.array(z.object({
      feature: z.string(),
      reaction: z.string(),
      visual: z.string(),
    })),
    pros: z.array(z.string()),
    cons: z.array(z.string()),
    verdict: z.string(),
    rating: z.string(),
    cta: z.string(),
  }),
  before_after: z.object({
    beforeSetup: z.string(),
    beforeVisual: z.string(),
    transitionHook: z.string(),
    afterReveal: z.string(),
    afterVisual: z.string(),
    keyDifferences: z.array(z.string()),
    socialProof: z.string(),
    cta: z.string(),
  }),
  unboxing: z.object({
    teaser: z.string(),
    packageReaction: z.string(),
    unboxingMoments: z.array(z.object({
      item: z.string(),
      reaction: z.string(),
      visual: z.string(),
    })),
    firstUse: z.string(),
    verdict: z.string(),
    cta: z.string(),
  }),
  carousel: z.object({
    slides: z.array(z.object({
      slideNumber: z.number(),
      headline: z.string(),
      body: z.string(),
      visualDescription: z.string(),
      ctaText: z.string().optional(),
    })),
    caption: z.string(),
    hashtags: z.array(z.string()),
  }),
  story_series: z.object({
    stories: z.array(z.object({
      storyNumber: z.number(),
      duration: z.number(),
      textOverlay: z.string(),
      visualDescription: z.string(),
      pollOrSticker: z.string().optional(),
      swipeUpCta: z.string().optional(),
    })),
    overallNarrative: z.string(),
  }),
  day_in_life: z.object({
    morningRoutine: z.string(),
    productIntegration: z.string(),
    naturalMoment: z.string(),
    benefits: z.array(z.string()),
    closingThought: z.string(),
    visualCues: z.array(z.string()),
    timing: z.array(z.object({
      section: z.string(),
      startTime: z.number(),
      endTime: z.number(),
      text: z.string(),
    })),
  }),
  trend_jacking: z.object({
    trendReference: z.string(),
    hook: z.string(),
    trendSetup: z.string(),
    productTie: z.string(),
    punchline: z.string(),
    cta: z.string(),
    soundSuggestion: z.string(),
    visualCues: z.array(z.string()),
    timing: z.array(z.object({
      section: z.string(),
      startTime: z.number(),
      endTime: z.number(),
      text: z.string(),
    })),
  }),
}

/**
 * Generate UGC-style content based on format
 */
export async function generateUGCContent(
  input: UGCGenerationInput
): Promise<UGCGenerationResult> {
  const systemPrompt = buildSystemPrompt(input)
  const userPrompt = buildUserPrompt(input)

  const schema = formatSchemas[input.format] || formatSchemas.talking_head

  const { object: script } = await generateObject({
    model: MODELS.STRUCTURED,
    system: systemPrompt,
    prompt: userPrompt,
    schema: schema as z.ZodType<Record<string, unknown>>,
  })

  // Generate additional content
  const { text: additionalContent } = await generateText({
    model: MODELS.FAST,
    system: 'You are a social media content strategist. Output valid JSON only.',
    prompt: `Generate supporting content for this ${input.format} ${input.platform} video about "${input.productName}".
    
Return JSON with:
- hooks: array of 3 alternative opening hooks
- hashtags: array of 10-15 relevant hashtags (without #)
- soundSuggestions: array of 3 trending sound/music suggestions
- postingTips: array of 3 tips for maximizing engagement

JSON only, no markdown:`,
  })

  let additional = { hooks: [], hashtags: [], soundSuggestions: [], postingTips: [] }
  try {
    additional = JSON.parse(additionalContent)
  } catch {
    // Use defaults if parsing fails
  }

  return {
    format: input.format,
    platform: input.platform,
    script: script as unknown as UGCGenerationResult['script'],
    hooks: additional.hooks || [],
    hashtags: additional.hashtags || [],
    soundSuggestions: additional.soundSuggestions || [],
    postingTips: additional.postingTips || [],
    estimatedDuration: input.duration || getDefaultDuration(input.format),
  }
}

function buildSystemPrompt(input: UGCGenerationInput): string {
  const styleGuides: Record<UGCStyle, string> = {
    authentic: 'Natural, unfiltered, relatable. Use casual language, show imperfections, be genuine.',
    polished: 'High-quality but still personal. Clean visuals with authentic delivery.',
    raw: 'Very unpolished, phone camera quality, spontaneous feeling. Real and unscripted vibes.',
    aesthetic: 'Visually pleasing, cohesive color palette, satisfying transitions.',
    comedic: 'Funny, entertaining, uses humor and trends. Self-aware and relatable jokes.',
    educational: 'Informative but engaging. Clear explanations with visual demonstrations.',
  }

  const platformGuides: Record<string, string> = {
    tiktok: 'Fast-paced, trend-aware, uses popular sounds. Hook in first 0.5 seconds. 15-60 seconds optimal.',
    instagram_reels: 'Slightly more polished than TikTok. 15-30 seconds optimal. Strong visual opening.',
    instagram_stories: 'Casual, ephemeral feel. Use polls, questions, stickers. 15 seconds per story.',
    youtube_shorts: 'Can be slightly longer. Good for tutorials. 30-60 seconds optimal.',
  }

  return `You are an expert UGC (User Generated Content) creator and influencer content strategist.

STYLE: ${styleGuides[input.style]}

PLATFORM: ${platformGuides[input.platform]}

FORMAT: ${getFormatDescription(input.format)}

KEY PRINCIPLES:
- Hook viewers in the first 1-3 seconds
- Use conversational, relatable language
- Include emotional triggers (curiosity, FOMO, excitement)
- Make content feel native to the platform
- Include clear calls-to-action
- Optimize for shareability and saves

${input.brandVoice ? `BRAND VOICE: ${input.brandVoice}` : ''}

Generate content that feels authentic and native to the platform, not like an ad.`
}

function buildUserPrompt(input: UGCGenerationInput): string {
  let prompt = `Create ${input.format.replace('_', ' ')} content for ${input.platform}.

PRODUCT: ${input.productName}
DESCRIPTION: ${input.productDescription}
TARGET AUDIENCE: ${input.targetAudience}
DURATION: ~${input.duration || getDefaultDuration(input.format)} seconds`

  if (input.keyMessages && input.keyMessages.length > 0) {
    prompt += `\n\nKEY MESSAGES TO INCLUDE:\n${input.keyMessages.map((m, i) => `${i + 1}. ${m}`).join('\n')}`
  }

  if (input.trendToJack) {
    prompt += `\n\nTREND TO INCORPORATE: ${input.trendToJack}`
  }

  return prompt
}

function getFormatDescription(format: UGCFormat): string {
  const descriptions: Record<UGCFormat, string> = {
    talking_head: 'Direct-to-camera video where creator speaks about the product. Personal, engaging, builds trust.',
    product_review: 'Honest review showing the product in use. Include pros, cons, and personal verdict.',
    day_in_life: 'Show product naturally integrated into daily routine. Lifestyle content that feels organic.',
    before_after: 'Transformation content showing results. High impact, proof-focused.',
    unboxing: 'First impressions and excitement of receiving/opening the product. Builds anticipation.',
    trend_jacking: 'Adapt a current trend to feature the product. Ride viral momentum.',
    story_series: 'Multi-part story that builds narrative. Great for engagement and watch time.',
    carousel: 'Swipeable multi-image post. Educational or listicle format. Great for saves.',
  }
  return descriptions[format]
}

function getDefaultDuration(format: UGCFormat): number {
  const durations: Record<UGCFormat, number> = {
    talking_head: 30,
    product_review: 45,
    day_in_life: 60,
    before_after: 15,
    unboxing: 45,
    trend_jacking: 15,
    story_series: 45, // Total across stories
    carousel: 0, // N/A for static
  }
  return durations[format]
}

/**
 * Get trending formats and topics for UGC content
 */
export async function getTrendSuggestions(
  platform: string,
  niche: string
): Promise<{
  trendingFormats: string[]
  trendingTopics: string[]
  trendingSounds: string[]
  recommendedTimes: string[]
}> {
  const { text } = await generateText({
    model: MODELS.FAST,
    system: 'You are a social media trends expert. Return JSON only.',
    prompt: `What are the current trending UGC formats, topics, and sounds for ${platform} in the ${niche} niche?

Return JSON with:
- trendingFormats: array of 5 trending content formats
- trendingTopics: array of 5 trending topics/angles
- trendingSounds: array of 5 trending sounds/music
- recommendedTimes: array of 3 best posting times

JSON only:`,
  })

  try {
    return JSON.parse(text)
  } catch {
    return {
      trendingFormats: ['Talking head reviews', 'Get ready with me', 'Day in my life', 'Before/after', 'POV content'],
      trendingTopics: ['Honest reviews', 'Hidden gems', 'Dupes', 'Life hacks', 'Hot takes'],
      trendingSounds: ['Original audio', 'Trending voiceovers', 'Lo-fi beats', 'Viral sounds'],
      recommendedTimes: ['9-11 AM', '12-2 PM', '7-9 PM'],
    }
  }
}

/**
 * Generate multiple hook variations for testing
 */
export async function generateHookVariations(
  productName: string,
  format: UGCFormat,
  count: number = 5
): Promise<string[]> {
  const { text } = await generateText({
    model: MODELS.CREATIVE,
    system: 'You are a viral content strategist. Generate hooks that stop scrollers.',
    prompt: `Generate ${count} different opening hooks for a ${format.replace('_', ' ')} video about "${productName}".

Each hook should:
- Be under 3 seconds when spoken
- Create curiosity or FOMO
- Feel authentic, not salesy

Return as a JSON array of strings:`,
  })

  try {
    return JSON.parse(text)
  } catch {
    return [`Wait, you need to see this ${productName}...`]
  }
}
