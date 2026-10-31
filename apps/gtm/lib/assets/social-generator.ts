/**
 * Social Post Generator (Feb 2026)
 *
 * Platform-specific social post generation with:
 * - Brand-consistent visual HTML output (like tryholo.ai)
 * - Satori rendering to PNG at correct platform dimensions
 * - Hashtags, character limits, A/B variants
 * - Claims extraction for compliance gate
 * - AssetDocument output for UADM pipeline
 */

import { generateObject } from '@/lib/ai/langsmith-ai';
import { z } from 'zod';
import { MODELS } from '@/lib/ai/ai-sdk-client';
import { detectAdjectiveStacks, detectSlop, extractNewClaims } from '@/lib/ai/anti-slop';
import { getBrandContext, getDefaultBrandContext, formatBrandPrompt, type BrandContext } from '@/lib/ai/brand-context';
import type { DesignArchetype } from '@/lib/design/archetype-selector';
import { buildSocialPrompt } from '@/lib/ai/prompts-v2';
import { searchTemplates } from '@/lib/templates/retriever';
import { brandContextToTokens } from '@/lib/templates/brand-assembler';
import {
  renderSocialVisualHtml,
  SOCIAL_DIMENSIONS,
  type VisualCategory,
  type SocialPlatform,
  type SocialVisualContent,
} from './social-visual-templates';
import { renderHtmlToImage } from '@/lib/render/html-renderer';
import { createAssetDocument, type AssetDocument, type ClaimRef } from './asset-document';
import { createServiceClient } from '@/lib/supabase/service';
import type { Campaign } from '@/lib/supabase/types';
import type { GenerationPlan } from '@/lib/planning/types';
import {
  buildPlanPromptContext,
  buildVisualTastePrompt,
  getSelectedCreativeRoute,
} from '@/lib/planning/generation-plan';

export type Platform = 'linkedin' | 'twitter' | 'facebook' | 'instagram' | 'tiktok';

export interface SocialPost {
  id: string;
  platform: Platform;
  content: string;
  hashtags: string[];
  characterCount: number;
  imagePrompt?: string;
  imageSizes: string[];
  claims: string[];
  thread?: string[];
  variantLabel: string;
  // Visual output (new — HTML-first pipeline)
  visualHtml?: string;
  visualCategory?: VisualCategory;
  renderedImageUrl?: string;
  dimensions?: { width: number; height: number };
  slopViolations?: string[];
  fabricatedClaims?: string[];
}

export interface SocialPostSet {
  posts: SocialPost[];
  variants: Map<Platform, SocialPost[]>;
}

export interface SocialGeneratorOptions {
  variants?: number;
  includeImagePrompts?: boolean;
  threadLength?: number;
  tone?: 'professional' | 'casual' | 'energetic';
  designArchetype?: DesignArchetype;
  plan?: GenerationPlan;
  improvementContext?: string;
}

// Platform specifications
const PLATFORM_SPECS: Record<Platform, {
  charLimit: number;
  hashtagCount: { min: number; max: number };
  imageSizes: string[];
  features: string[];
}> = {
  linkedin: {
    charLimit: 3000,
    hashtagCount: { min: 3, max: 5 },
    imageSizes: ['1200x627', '1080x1080'],
    features: ['professional tone', 'industry insights', 'thought leadership', 'case studies'],
  },
  twitter: {
    charLimit: 280,
    hashtagCount: { min: 1, max: 2 },
    imageSizes: ['1200x675', '1200x1200'],
    features: ['punchy hooks', 'threads for depth', 'engagement bait', 'quotable takes'],
  },
  facebook: {
    charLimit: 63206,
    hashtagCount: { min: 0, max: 3 },
    imageSizes: ['1200x630', '1080x1080'],
    features: ['storytelling', 'community engagement', 'longer form ok', 'questions'],
  },
  instagram: {
    charLimit: 2200,
    hashtagCount: { min: 20, max: 30 },
    imageSizes: ['1080x1080', '1080x1920', '1080x566'],
    features: ['visual-first', 'lifestyle content', 'carousel stories', 'reels hooks'],
  },
  tiktok: {
    charLimit: 2200,
    hashtagCount: { min: 3, max: 5 },
    imageSizes: ['1080x1920'],
    features: ['hook in 3 seconds', 'trendy', 'raw authenticity', 'story arc'],
  },
};

// Schema for generated posts - all fields required for OpenAI JSON mode
const SocialPostSchema = z.object({
  content: z.string().describe('The post content'),
  hashtags: z.array(z.string()).describe('Hashtags without the # symbol'),
  imagePrompt: z.string().describe('AI image generation prompt - use empty string if not needed'),
  thread: z.array(z.string()).describe('Thread parts for Twitter/X - use empty array for non-threads'),
  claims: z.array(z.string()).describe('Marketing claims made in the post - use empty array if none'),
});

const SocialPostSetSchema = z.object({
  posts: z.array(SocialPostSchema),
});

type GeneratedSocialPostSet = z.infer<typeof SocialPostSetSchema>;

// Claim patterns to detect
const CLAIM_PATTERNS = [
  /\d+%\s+(?:increase|decrease|improvement|reduction|faster|more|less)/i,
  /\d+x\s+(?:faster|better|more|improvement)/i,
  /#1\s+(?:rated|ranked|choice|solution)/i,
  /best[\s-]in[\s-]class/i,
  /industry[\s-]leading/i,
  /trusted by\s+(?:\d+|thousands|millions)/i,
  /proven\s+(?:to|results)/i,
  /guaranteed/i,
  /award[\s-]winning/i,
  /certified/i,
  /compliant/i,
];

/**
 * Extract claims from text content
 */
function extractClaims(text: string): string[] {
  const claims: string[] = [];
  
  // Split into sentences
  const sentences = text.split(/[.!?]+/).filter(s => s.trim());
  
  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    
    // Check against claim patterns
    for (const pattern of CLAIM_PATTERNS) {
      if (pattern.test(trimmed)) {
        claims.push(trimmed);
        break;
      }
    }
    
    // Check for statistical claims
    if (/\d+(?:\.\d+)?(?:%|x|X)\s/.test(trimmed)) {
      if (!claims.includes(trimmed)) {
        claims.push(trimmed);
      }
    }
    
    // Check for superlative claims
    if (/\b(best|fastest|leading|top|#1|first|only|unique|revolutionary)\b/i.test(trimmed)) {
      if (!claims.includes(trimmed)) {
        claims.push(trimmed);
      }
    }
  }
  
  return [...new Set(claims)]; // Remove duplicates
}

/**
 * Generate social posts for a campaign
 */
export async function generateSocialPosts(
  campaign: Campaign,
  workspaceId: string,
  platforms: Platform[],
  options: SocialGeneratorOptions = {}
): Promise<SocialPostSet> {
  const brandContext =
    (await getBrandContext(workspaceId, campaign.brand_id ?? undefined)) ?? getDefaultBrandContext();
  const variants = options.variants || 2;
  const selectedRoute = options.plan ? getSelectedCreativeRoute(options.plan) : null;
  
  // Get template references for visual style consistency
  const templates = await searchTemplates({ 
    prompt: `${campaign.goal || 'marketing'} ${campaign.audience || 'professional'} hero section ${options.designArchetype?.direction ?? 'auto'} restrained proof-forward ${selectedRoute?.headlineAngle ?? ''}`,
    category: 'hero',
    topK: 2,
  }).catch(() => []); // Graceful fallback if templates unavailable
  
  // Extract visual style hints from templates
  const visualStyleHint = templates.length > 0 
    ? `Visual Style Guide (for image prompts):
- Color approach: ${templates[0].colorPattern?.dominantApproach || 'professional'}
- Design aesthetic: ${templates[0].aestheticTags?.slice(0, 3).join(', ') || 'modern, clean'}
- Typography pattern: ${templates[0].typographyPattern?.headlineStyle || 'bold-impact'}
Keep the visual system restrained. Avoid novelty gradients, glass cards, emoji filler, and fake dashboard framing.
Use this style when suggesting images.`
    : '';
  
  const allPosts: SocialPost[] = [];
  const variantsMap = new Map<Platform, SocialPost[]>();
  
  // Generate for each platform
  for (const platform of platforms) {
    const platformPosts = await generateForPlatform(
      campaign,
      brandContext,
      platform,
      variants,
      options,
      visualStyleHint
    );
    
    allPosts.push(...platformPosts);
    variantsMap.set(platform, platformPosts);
  }
  
  return {
    posts: allPosts,
    variants: variantsMap,
  };
}

/**
 * Generate posts for a specific platform
 */
async function generateForPlatform(
  campaign: Campaign,
  brandContext: BrandContext | null,
  platform: Platform,
  variants: number,
  options: SocialGeneratorOptions,
  visualStyleHint: string = ''
): Promise<SocialPost[]> {
  const specs = PLATFORM_SPECS[platform];
  const planPrompt = options.plan ? buildPlanPromptContext(options.plan) : '';
  const visualTastePrompt = options.plan ? buildVisualTastePrompt(options.plan) : '';
  const selectedRoute = options.plan ? getSelectedCreativeRoute(options.plan) : null;
  
  // Guard against invalid platform
  if (!specs) {
    throw new Error(`Unsupported platform: ${platform}. Supported: ${Object.keys(PLATFORM_SPECS).join(', ')}`);
  }
  
  const variantLabels = ['A', 'B', 'C', 'D', 'E'].slice(0, variants);
  
  const { object } = await generateObject({
    model: MODELS.CREATIVE,
    schema: SocialPostSetSchema,
    system: buildSocialPrompt(
      {
        audience: campaign.audience || 'general',
        brandVoice: brandContext ? formatBrandPrompt(brandContext) : undefined,
      },
      platform === 'facebook' || platform === 'instagram' || platform === 'tiktok' ? 'meta' : platform
    ),
    prompt: `Generate ${variants} social media post${variants > 1 ? 's' : ''} for ${platform.toUpperCase()}.

CAMPAIGN:
- Name: ${campaign.name}
- Audience: ${campaign.audience || 'general'}
- Goal: ${campaign.goal || 'awareness'}
- Key Message: ${campaign.offer || campaign.name}
- CTA: ${campaign.cta || 'Learn more'}

BRAND:
${brandContext ? formatBrandPrompt(brandContext) : '- Voice: professional'}

${visualStyleHint}
${planPrompt ? `\n${planPrompt}\n` : ''}
${visualTastePrompt ? `\n${visualTastePrompt}\n` : ''}
${options.improvementContext ? `\n${options.improvementContext}\n` : ''}

PLATFORM REQUIREMENTS (${platform}):
- Character limit: ${specs.charLimit}
- Hashtag count: ${specs.hashtagCount.min}-${specs.hashtagCount.max}
- Best practices: ${specs.features.join(', ')}
${platform === 'twitter' && options.threadLength ? `- Create a ${options.threadLength}-part thread` : ''}
${selectedRoute ? `- Selected route framing: ${selectedRoute.label} (${selectedRoute.headlineAngle})` : ''}

TONE: ${options.tone || 'professional'}

Generate ${variants} unique variants labeled A, B${variants > 2 ? ', C' : ''} that:
1. Stay within character limits
2. Have platform-appropriate hashtags
3. Include a strong hook
4. End with a clear CTA
5. Are different enough to A/B test
6. Mark any new factual assertion with [NEW_CLAIM]
7. Reflect the chosen route rather than repeating one generic campaign summary
8. Vary proof, urgency, and product specificity intentionally for ${platform}

${options.includeImagePrompts ? 'Also suggest an AI image generation prompt for each post that aligns with the visual style guide above.' : ''}`,
  });
  
  // Process results — now with visual HTML generation
  const results: SocialPost[] = [];
  const typedPostSet = object as GeneratedSocialPostSet;

  for (let idx = 0; idx < typedPostSet.posts.length; idx++) {
    const post = typedPostSet.posts[idx];
    const content = truncateToLimit(post.content, specs.charLimit);
    const hashtags = post.hashtags.slice(0, specs.hashtagCount.max);

    // Extract claims
    const aiClaims = post.claims || [];
    const patternClaims = extractClaims(content);
    const newClaims = extractNewClaims(content);
    const slopViolations = [
      ...detectSlop(content, brandContext?.messaging.valuePropositions),
      ...detectAdjectiveStacks(content).map((stack) => ({
        phrase: stack,
        location: content.indexOf(stack),
        fix: 'Rewrite the adjective stack with one concrete descriptor',
        severity: 'hard' as const,
      })),
    ];
    const allClaims = [...new Set([...aiClaims, ...patternClaims, ...newClaims])];

    // Determine visual category based on content
    const visualCategory = detectVisualCategory(content);

    // Generate branded visual HTML
    let visualHtml: string | undefined;
    let dimensions: { width: number; height: number } | undefined;

    if (brandContext) {
      const brandTokens = brandContextToTokens(brandContext);
      const platformKey = platform as SocialPlatform;
      const dims = SOCIAL_DIMENSIONS[platformKey] ?? SOCIAL_DIMENSIONS.linkedin;
      dimensions = { width: dims.width, height: dims.height };

      const visualContent: SocialVisualContent = {
        headline: content.split('\n')[0]?.slice(0, 80),
        body: content,
        logoUrl: brandTokens.logoUrl,
        brandName: brandContext.name,
        quote: visualCategory === 'quote_card' ? content : undefined,
        statValue: visualCategory === 'stat_card' ? extractStatValue(content) : undefined,
        statLabel: visualCategory === 'stat_card' ? extractStatLabel(content) : undefined,
        tips: visualCategory === 'tips_list' ? content.split('\n').filter((l) => l.trim()) : undefined,
      };

      visualHtml = renderSocialVisualHtml(
        visualCategory,
        visualContent,
        brandTokens,
        platformKey,
        options.designArchetype,
      );
    }

    results.push({
      id: `${platform}-${variantLabels[idx]}-${Date.now()}`,
      platform,
      content,
      hashtags,
      characterCount: content.length,
      imagePrompt: options.includeImagePrompts ? post.imagePrompt : undefined,
      imageSizes: specs.imageSizes,
      claims: allClaims,
      thread: post.thread,
      variantLabel: variantLabels[idx],
      visualHtml,
      visualCategory,
      dimensions,
      slopViolations: slopViolations.map((violation) => `${violation.severity}:${violation.phrase}`),
      fabricatedClaims: newClaims,
    });
  }

  return results;
}

/**
 * Truncate content to character limit
 */
function truncateToLimit(content: string, limit: number): string {
  if (content.length <= limit) return content;
  
  // Try to truncate at a sentence boundary
  const truncated = content.slice(0, limit - 3);
  const lastPeriod = truncated.lastIndexOf('.');
  const lastExclamation = truncated.lastIndexOf('!');
  const lastQuestion = truncated.lastIndexOf('?');
  
  const lastSentence = Math.max(lastPeriod, lastExclamation, lastQuestion);
  
  if (lastSentence > limit * 0.7) {
    return truncated.slice(0, lastSentence + 1);
  }
  
  return truncated + '...';
}

/**
 * Generate a Twitter/X thread
 */
export async function generateThread(
  campaign: Campaign,
  workspaceId: string,
  threadLength: number = 5
): Promise<SocialPost> {
  const brandContext = await getBrandContext(workspaceId);
  
  const ThreadSchema = z.object({
    hook: z.string().describe('First tweet - the hook'),
    parts: z.array(z.string()).describe('Thread parts (each under 280 chars)'),
    closer: z.string().describe('Final tweet with CTA'),
    hashtags: z.array(z.string()).describe('Hashtags for the thread'),
  });
  type GeneratedThread = z.infer<typeof ThreadSchema>;
  
  const { object } = await generateObject({
    model: MODELS.CREATIVE,
    schema: ThreadSchema,
    prompt: `Create a ${threadLength}-part Twitter/X thread about this campaign.

CAMPAIGN:
- Name: ${campaign.name}
- Audience: ${campaign.audience || 'general'}
- Goal: ${campaign.goal || 'awareness'}
- Key Message: ${campaign.offer || campaign.name}

BRAND VOICE: ${brandContext?.voice?.tone || 'professional'}

Create a compelling thread that:
1. Starts with an irresistible hook
2. Delivers value in each tweet
3. Uses proper thread formatting (1/, 2/, etc.)
4. Ends with a strong CTA
5. Each part MUST be under 280 characters

Structure:
- Hook: Create curiosity or state a bold claim
- Middle: Share insights, tips, or story beats
- Closer: Call to action`,
  });
  
  const typedThread = object as GeneratedThread;
  const thread = [typedThread.hook, ...typedThread.parts, typedThread.closer];
  
  return {
    id: `twitter-thread-${Date.now()}`,
    platform: 'twitter',
    content: thread[0],
    hashtags: typedThread.hashtags.slice(0, 2),
    characterCount: thread[0].length,
    imageSizes: ['1200x675'],
    claims: [],
    thread,
    variantLabel: 'Thread',
  };
}

/**
 * Generate LinkedIn carousel post
 */
export async function generateLinkedInCarousel(
  campaign: Campaign,
  workspaceId: string,
  slideCount: number = 8
): Promise<{
  post: SocialPost;
  slides: Array<{ headline: string; body: string; slideNumber: number }>;
}> {
  const brandContext = await getBrandContext(workspaceId);
  
  const CarouselSchema = z.object({
    post: z.string().describe('The LinkedIn post text'),
    hashtags: z.array(z.string()),
    slides: z.array(z.object({
      headline: z.string().describe('Slide headline (short, punchy)'),
      body: z.string().describe('Slide body text (1-2 sentences)'),
    })),
  });
  type GeneratedCarousel = z.infer<typeof CarouselSchema>;
  
  const { object } = await generateObject({
    model: MODELS.CREATIVE,
    schema: CarouselSchema,
    prompt: `Create a LinkedIn carousel post about this campaign.

CAMPAIGN:
- Name: ${campaign.name}
- Audience: ${campaign.audience || 'professionals'}
- Goal: ${campaign.goal || 'thought leadership'}
- Key Message: ${campaign.offer || campaign.name}

BRAND VOICE: ${brandContext?.voice?.tone || 'professional'}

Create a ${slideCount}-slide carousel that:
1. Has a scroll-stopping first slide
2. Delivers value on each slide
3. Uses short, scannable text
4. Ends with a CTA slide
5. Has an engaging post to accompany it

Structure:
- Slide 1: Hook/title
- Slides 2-${slideCount - 1}: Content slides
- Slide ${slideCount}: CTA`,
  });
  
  const typedCarousel = object as GeneratedCarousel;

  return {
    post: {
      id: `linkedin-carousel-${Date.now()}`,
      platform: 'linkedin',
      content: typedCarousel.post,
      hashtags: typedCarousel.hashtags.slice(0, 5),
      characterCount: typedCarousel.post.length,
      imageSizes: ['1080x1080'],
      claims: [],
      variantLabel: 'Carousel',
    },
    slides: typedCarousel.slides.map((slide, idx) => ({
      ...slide,
      slideNumber: idx + 1,
    })),
  };
}

/**
 * Validate post against platform rules
 */
export function validatePost(post: SocialPost): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const specs = PLATFORM_SPECS[post.platform];
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Guard against invalid platform
  if (!specs) {
    return { valid: false, errors: [`Unsupported platform: ${post.platform}`], warnings: [] };
  }
  
  // Character limit
  if (post.characterCount > specs.charLimit) {
    errors.push(`Exceeds ${post.platform} character limit (${post.characterCount}/${specs.charLimit})`);
  }
  
  // Hashtag count
  if (post.hashtags.length < specs.hashtagCount.min) {
    warnings.push(`Consider adding more hashtags (${post.hashtags.length}/${specs.hashtagCount.min} minimum)`);
  }
  if (post.hashtags.length > specs.hashtagCount.max) {
    warnings.push(`Too many hashtags (${post.hashtags.length}/${specs.hashtagCount.max} maximum)`);
  }
  
  // Content checks
  if (!post.content.includes('http') && !post.content.toLowerCase().includes('link in bio')) {
    warnings.push('No link detected - consider adding a CTA link');
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Generate social posts as AssetDocuments (UADM pipeline)
 * Includes visual HTML + rendered image upload
 */
export async function generateSocialPostDocuments(
  campaign: Campaign,
  workspaceId: string,
  brandId: string,
  platforms: Platform[] = ['linkedin'],
  options: SocialGeneratorOptions = {},
  campaignId?: string
): Promise<AssetDocument[]> {
  const postSet = await generateSocialPosts(campaign, workspaceId, platforms, {
    ...options,
    includeImagePrompts: true,
  });

  const documents: AssetDocument[] = [];

  for (const post of postSet.posts) {
    // Render visual to image if HTML available
    let renderedImageUrl: string | undefined;

    if (post.visualHtml && post.dimensions) {
      try {
        const result = await renderHtmlToImage(post.visualHtml, {
          width: post.dimensions.width,
          height: post.dimensions.height,
          format: 'png',
        });

        // Upload to Supabase storage
        const supabase = createServiceClient();
        const storagePath = `workspace/${workspaceId}/social/${post.id}.png`;
        const { error: uploadError } = await supabase.storage
          .from('asset-renders')
          .upload(storagePath, result.buffer, {
            contentType: 'image/png',
            upsert: true,
          });

        if (!uploadError) {
          const { data: publicUrl } = supabase.storage
            .from('asset-renders')
            .getPublicUrl(storagePath);
          renderedImageUrl = publicUrl.publicUrl;
        }
      } catch (err) {
        console.warn(`Failed to render social post ${post.id}:`, err);
      }
    }

    const claims: ClaimRef[] = post.claims.map((text) => ({
      id: crypto.randomUUID(),
      text,
      riskScore: post.fabricatedClaims?.includes(text) ? 65 : 0,
      riskLevel: post.fabricatedClaims?.includes(text) ? 'high' as const : 'low' as const,
      status: 'unverified' as const,
      evidenceIds: [],
      suggestedRewrite: post.fabricatedClaims?.includes(text) ? 'Review this AI-generated claim against approved source material.' : undefined,
    }));

    const slopClaims: ClaimRef[] = (post.slopViolations ?? []).map((violation) => ({
      id: crypto.randomUUID(),
      text: `Slop detector: ${violation}`,
      riskScore: violation.startsWith('hard:') ? 55 : 35,
      riskLevel: violation.startsWith('hard:') ? 'medium' as const : 'low' as const,
      status: 'unverified' as const,
      evidenceIds: [],
      suggestedRewrite: 'Rewrite with a concrete fact, outcome, or action instead of generic marketing phrasing.',
    }));

    const doc = createAssetDocument({
      workspaceId,
      brandId,
      campaignId,
      type: 'social',
      channel: post.platform === 'tiktok' ? 'facebook' : post.platform,
      html: post.visualHtml ?? buildFallbackHtml(post),
      blocks: [
        { id: crypto.randomUUID(), type: 'body', content: post.content },
        ...(post.hashtags.length
          ? [{ id: crypto.randomUUID(), type: 'custom' as const, content: post.hashtags.map((h) => `#${h}`).join(' ') }]
          : []),
      ],
      dimensions: post.dimensions,
      claims: [...claims, ...slopClaims],
      title: `${post.platform} — ${post.variantLabel}`,
    });

    // Attach rendered image
    if (renderedImageUrl) {
      (doc as AssetDocument).renderedImageUrl = renderedImageUrl;
    }

    documents.push(doc);
  }

  return documents;
}

// ============================================================================
// Visual category detection
// ============================================================================

function detectVisualCategory(content: string): VisualCategory {
  // Detect stat cards (numbers, percentages)
  if (/\d+[%xX]|\d{2,}/.test(content) && content.length < 200) {
    return 'stat_card';
  }
  // Detect tips/lists (numbered items or bullet patterns)
  if (/(?:^|\n)\s*[\d•\-\*]\s/m.test(content) || content.split('\n').filter((l) => l.trim()).length >= 3) {
    return 'tips_list';
  }
  // Detect quotes
  if (content.startsWith('"') || content.startsWith('\u201C') || content.includes('\u2014')) {
    return 'quote_card';
  }
  // Default to announcement
  return 'announcement';
}

function extractStatValue(content: string): string {
  const match = content.match(/(\d+[%xX+]?|\$[\d,.]+[MBK]?)/);
  return match ? match[1] : '';
}

function extractStatLabel(content: string): string {
  const match = content.match(/\d+[%xX+]?\s+(.{5,40}?)(?:\.|,|\n|$)/);
  return match ? match[1].trim() : '';
}

function buildFallbackHtml(post: SocialPost): string {
  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Inter', system-ui; display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #0f172a; color: #f8fafc; padding: 48px; }
  .content { font-size: 24px; line-height: 1.5; white-space: pre-wrap; }
  .hashtags { font-size: 16px; color: #3b82f6; margin-top: 24px; }
</style></head>
<body>
<div>
  <p class="content">${escapeHtmlStr(post.content)}</p>
  ${post.hashtags.length ? `<p class="hashtags">${post.hashtags.map((h) => '#' + h).join(' ')}</p>` : ''}
</div>
</body></html>`;
}

function escapeHtmlStr(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * Format post with hashtags for display/copy
 */
export function formatPostForPlatform(post: SocialPost): string {
  let formatted = post.content;
  
  if (post.hashtags.length > 0) {
    const hashtagString = post.hashtags.map(h => `#${h}`).join(' ');
    
    switch (post.platform) {
      case 'instagram':
        // Instagram: hashtags in a separate paragraph
        formatted += '\n\n.\n.\n.\n\n' + hashtagString;
        break;
      case 'linkedin':
        // LinkedIn: hashtags at the end with a line break
        formatted += '\n\n' + hashtagString;
        break;
      case 'twitter':
        // Twitter: hashtags inline if space allows
        if (formatted.length + hashtagString.length + 2 <= 280) {
          formatted += '\n\n' + hashtagString;
        }
        break;
      default:
        formatted += '\n\n' + hashtagString;
    }
  }
  
  return formatted;
}
