/**
 * UGC / Influencer Content Generator (Holo-style)
 * 
 * Generates influencer-style content scripts for:
 * - TikTok talking-head videos
 * - Instagram Reels
 * - YouTube Shorts
 * - Product unboxing scripts
 * - Review scripts
 * 
 * Output includes: hook, talking points, B-roll suggestions, CTA,
 * trending audio suggestions.
 */

import { generateObject } from '@/lib/ai/langsmith-ai'
import { z } from 'zod'
import { MODELS } from '@/lib/ai/ai-sdk-client'
import { getBrandContext } from '@/lib/ai/brand-context'

// ============================================================================
// Types
// ============================================================================

export type UGCFormat = 
  | 'talking-head'
  | 'product-demo'
  | 'unboxing'
  | 'review'
  | 'tutorial'
  | 'day-in-life'
  | 'get-ready-with-me'
  | 'storytime'

export type UGCPlatform = 'tiktok' | 'instagram' | 'youtube-shorts'

export interface UGCScript {
  id: string
  format: UGCFormat
  platform: UGCPlatform
  duration: number // seconds
  hook: {
    text: string
    timing: string
    visualSuggestion: string
  }
  script: Array<{
    section: string
    timing: string
    voiceover: string
    onScreenText?: string
    visualDirection: string
    bRoll?: string
  }>
  talkingPoints: string[]
  ctaScript: string
  trendingAudioSuggestions: string[]
  hashtags: string[]
  captionOptions: string[]
  productMentions: string[]
  claims: string[]
}

export interface UGCGeneratorOptions {
  format?: UGCFormat
  platform?: UGCPlatform
  duration?: number // target duration in seconds
  tone?: 'authentic' | 'energetic' | 'casual' | 'professional'
  includeUnboxing?: boolean
  variants?: number
}

// ============================================================================
// Schemas
// ============================================================================

const UGCScriptSchema = z.object({
  hook: z.object({
    text: z.string().describe('Opening hook line (first 2-3 seconds)'),
    timing: z.string().describe('Timing for the hook'),
    visualSuggestion: z.string().describe('What should be on screen during hook'),
  }),
  script: z.array(z.object({
    section: z.string().describe('Section name (intro, main, demo, cta)'),
    timing: z.string().describe('Timestamp range'),
    voiceover: z.string().describe('What to say'),
    onScreenText: z.string().optional().describe('Text overlay'),
    visualDirection: z.string().describe('Camera/visual direction'),
    bRoll: z.string().optional().describe('B-roll footage suggestion'),
  })),
  talkingPoints: z.array(z.string()).describe('Key points to cover'),
  ctaScript: z.string().describe('Call to action script'),
  trendingAudioSuggestions: z.array(z.string()).describe('Trending audio/sound suggestions'),
  hashtags: z.array(z.string()).describe('Relevant hashtags'),
  captionOptions: z.array(z.string()).describe('3 caption options'),
  productMentions: z.array(z.string()).describe('How/when to mention the product'),
  claims: z.array(z.string()).describe('Marketing claims made'),
})

const UGCBatchSchema = z.object({
  scripts: z.array(UGCScriptSchema),
})

// ============================================================================
// Format Definitions
// ============================================================================

const FORMAT_TEMPLATES: Record<UGCFormat, {
  name: string
  description: string
  structure: string
  bestPractices: string[]
}> = {
  'talking-head': {
    name: 'Talking Head',
    description: 'Direct-to-camera content delivery',
    structure: 'Hook → Problem/Story → Solution → Demo/Proof → CTA',
    bestPractices: [
      'Make eye contact with camera',
      'Use hand gestures for emphasis',
      'Keep energy high throughout',
      'Change angles/positions to maintain interest',
    ],
  },
  'product-demo': {
    name: 'Product Demo',
    description: 'Showcase product features and benefits',
    structure: 'Hook → Problem → Product Intro → Demo → Results → CTA',
    bestPractices: [
      'Show the product in use',
      'Highlight key features visually',
      'Include before/after if applicable',
      'Keep demo under 30 seconds',
    ],
  },
  'unboxing': {
    name: 'Unboxing',
    description: 'First impressions and package reveal',
    structure: 'Hook → Package Tease → Unboxing → First Impressions → Key Features → CTA',
    bestPractices: [
      'Build anticipation before reveal',
      'React genuinely to each item',
      'Show packaging quality',
      'Touch and feel the products',
    ],
  },
  'review': {
    name: 'Review',
    description: 'Honest product assessment',
    structure: 'Hook → Context → Pros → Cons → Verdict → CTA',
    bestPractices: [
      'Be authentic and balanced',
      'Include specific use cases',
      'Compare to alternatives if relevant',
      'Give clear recommendation',
    ],
  },
  'tutorial': {
    name: 'Tutorial / How-To',
    description: 'Step-by-step educational content',
    structure: 'Hook → Problem/Goal → Steps → Results → Pro Tips → CTA',
    bestPractices: [
      'Number your steps clearly',
      'Show each step visually',
      'Keep each step concise',
      'Include common mistakes to avoid',
    ],
  },
  'day-in-life': {
    name: 'Day in the Life',
    description: 'Lifestyle integration content',
    structure: 'Hook → Morning → Product Use → Throughout Day → Evening → Reflection',
    bestPractices: [
      'Make product integration natural',
      'Show real-life scenarios',
      'Include relatable moments',
      'Keep authentic and unscripted feel',
    ],
  },
  'get-ready-with-me': {
    name: 'Get Ready With Me (GRWM)',
    description: 'Preparation routine with product integration',
    structure: 'Hook → Setup → Step-by-step Routine → Final Look → CTA',
    bestPractices: [
      'Chat naturally while getting ready',
      'Integrate product seamlessly',
      'Show application/use close-ups',
      'Include tips along the way',
    ],
  },
  'storytime': {
    name: 'Storytime',
    description: 'Narrative-driven content',
    structure: 'Hook → Setup → Rising Action → Climax → Resolution → CTA',
    bestPractices: [
      'Start with intriguing hook',
      'Build tension/curiosity',
      'Make product part of the story',
      'End with satisfying conclusion',
    ],
  },
}

// ============================================================================
// Generator Functions
// ============================================================================

/**
 * Generate UGC/Influencer style content script
 */
export async function generateUGCScript(
  productInfo: {
    name: string
    description: string
    features?: string[]
    benefits?: string[]
    targetAudience?: string
    price?: string
  },
  workspaceId: string,
  options: UGCGeneratorOptions = {}
): Promise<UGCScript[]> {
  const {
    format = 'talking-head',
    platform = 'tiktok',
    duration = 30,
    tone = 'authentic',
    variants = 2,
  } = options

  const brandContext = await getBrandContext(workspaceId)
  const formatTemplate = FORMAT_TEMPLATES[format]
  const variantLabels = ['A', 'B', 'C', 'D', 'E'].slice(0, variants)

  const { object } = await generateObject({
    model: MODELS.CREATIVE,
    schema: UGCBatchSchema,
    prompt: `Generate ${variants} UGC/influencer-style video script(s).

PRODUCT INFORMATION:
- Name: ${productInfo.name}
- Description: ${productInfo.description}
${productInfo.features ? `- Key Features: ${productInfo.features.join(', ')}` : ''}
${productInfo.benefits ? `- Benefits: ${productInfo.benefits.join(', ')}` : ''}
${productInfo.targetAudience ? `- Target Audience: ${productInfo.targetAudience}` : ''}
${productInfo.price ? `- Price Point: ${productInfo.price}` : ''}

${brandContext ? `
BRAND CONTEXT:
- Brand: ${brandContext.name}
- Voice: ${brandContext.voice?.tone || 'authentic'}
` : ''}

FORMAT: ${formatTemplate.name}
${formatTemplate.description}

STRUCTURE:
${formatTemplate.structure}

BEST PRACTICES:
${formatTemplate.bestPractices.map(bp => `- ${bp}`).join('\n')}

PLATFORM: ${platform.toUpperCase()}
TARGET DURATION: ${duration} seconds
TONE: ${tone}

PLATFORM-SPECIFIC REQUIREMENTS:
${getPlatformRequirements(platform)}

UGC CONTENT GUIDELINES:
1. HOOK (first 2-3 seconds):
   - Must stop the scroll immediately
   - Create curiosity or relatability
   - Can be a question, statement, or visual hook

2. AUTHENTICITY:
   - Sound like a real person, not an ad
   - Include natural speech patterns
   - Add genuine reactions and emotions

3. VISUAL VARIETY:
   - Change shots every 3-5 seconds
   - Mix talking head with B-roll
   - Include product close-ups

4. CTA:
   - Natural, not pushy
   - Clear next step
   - Tied to platform (link in bio, etc.)

Generate ${variants} unique script variants with different hooks and angles.`,
  })

  const result = object as { scripts: Array<{ hook: { text: string; timing: string; visualSuggestion: string }; script: Array<{ section: string; timing: string; voiceover: string; onScreenText?: string; visualDirection: string; bRoll?: string }>; talkingPoints: string[]; ctaScript: string; trendingAudioSuggestions: string[]; hashtags: string[]; captionOptions: string[]; productMentions: string[]; claims: string[] }> }
  return result.scripts.map((script, idx) => ({
    id: `ugc-${format}-${platform}-${variantLabels[idx]}-${Date.now()}`,
    format,
    platform,
    duration,
    hook: script.hook,
    script: script.script,
    talkingPoints: script.talkingPoints,
    ctaScript: script.ctaScript,
    trendingAudioSuggestions: script.trendingAudioSuggestions,
    hashtags: script.hashtags,
    captionOptions: script.captionOptions,
    productMentions: script.productMentions,
    claims: script.claims,
  }))
}

function getPlatformRequirements(platform: UGCPlatform): string {
  switch (platform) {
    case 'tiktok':
      return `
- 9:16 vertical format (1080x1920)
- Duration: 15-60 seconds (sweet spot: 21-34 seconds)
- Native, unpolished aesthetic performs best
- Trending sounds boost reach significantly
- Text overlays for silent viewing
- Hook in first 2 seconds is CRITICAL`

    case 'instagram':
      return `
- 9:16 vertical format (1080x1920)
- Duration: 15-90 seconds
- Slightly more polished than TikTok
- Reels get more reach than feed posts
- Carousel option for longer content
- Strong visual thumbnail matters`

    case 'youtube-shorts':
      return `
- 9:16 vertical format (1080x1920)
- Duration: up to 60 seconds
- Subscribe CTA works well
- Can link to longer content
- Slightly longer attention span than TikTok
- Good for educational content`

    default:
      return ''
  }
}

/**
 * Generate unboxing-specific script
 */
export async function generateUnboxingScript(
  productInfo: {
    name: string
    brand: string
    packageDescription?: string
    itemsIncluded?: string[]
    firstImpressions?: string
    targetAudience?: string
  },
  workspaceId: string,
  options: Omit<UGCGeneratorOptions, 'format'> = {}
): Promise<UGCScript[]> {
  return generateUGCScript(
    {
      name: productInfo.name,
      description: `Unboxing of ${productInfo.name} from ${productInfo.brand}`,
      features: productInfo.itemsIncluded,
      targetAudience: productInfo.targetAudience,
    },
    workspaceId,
    { ...options, format: 'unboxing' }
  )
}

/**
 * Generate product review script
 */
export async function generateReviewScript(
  productInfo: {
    name: string
    description: string
    pros?: string[]
    cons?: string[]
    rating?: number
    comparedTo?: string[]
    targetAudience?: string
  },
  workspaceId: string,
  options: Omit<UGCGeneratorOptions, 'format'> = {}
): Promise<UGCScript[]> {
  return generateUGCScript(
    {
      name: productInfo.name,
      description: productInfo.description,
      features: productInfo.pros,
      benefits: productInfo.cons ? [`Considerations: ${productInfo.cons.join(', ')}`] : undefined,
      targetAudience: productInfo.targetAudience,
    },
    workspaceId,
    { ...options, format: 'review' }
  )
}

/**
 * Get available formats
 */
export function getAvailableFormats(): Array<{
  id: UGCFormat
  name: string
  description: string
}> {
  return Object.entries(FORMAT_TEMPLATES).map(([id, template]) => ({
    id: id as UGCFormat,
    name: template.name,
    description: template.description,
  }))
}

/**
 * Get format details
 */
export function getFormatDetails(format: UGCFormat) {
  return FORMAT_TEMPLATES[format]
}

/**
 * Generate trending hook ideas
 */
export async function generateTrendingHooks(
  productName: string,
  platform: UGCPlatform = 'tiktok',
  count: number = 10
): Promise<string[]> {
  const HooksSchema = z.object({
    hooks: z.array(z.string()).describe(`${count} trending hook ideas`),
  })

  const { object } = await generateObject({
    model: MODELS.CREATIVE,
    schema: HooksSchema,
    prompt: `Generate ${count} trending-style video hooks for ${productName} on ${platform}.

VIRAL HOOK PATTERNS:
- "POV: you just discovered..."
- "Here's what nobody tells you about..."
- "I tested [X] so you don't have to"
- "Stop scrolling if you [pain point]"
- "The secret to [X] that no one talks about"
- "Why is everyone talking about..."
- "This changed everything for me"
- "I was today years old when I learned..."
- "Things I wish I knew before..."
- "The [product] that broke the internet"

Generate ${count} unique, attention-grabbing hooks that would work for ${platform}.
Each hook should be 1-2 sentences max, designed to stop the scroll.`,
  })

  const result = object as { hooks: string[] }
  return result.hooks
}
