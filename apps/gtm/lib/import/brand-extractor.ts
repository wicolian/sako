/**
 * Brand Extractor AI (Jan 2026)
 * 
 * AI-powered brand analysis from page content including
 * voice, tone, audience, industry, and value propositions.
 */

import { generateObject } from '@/lib/ai/langsmith-ai';
import { z } from 'zod';
import { MODELS } from '@/lib/ai/ai-sdk-client';
import { buildBrandExtractionSystemPrompt } from '@/lib/ai/prompts-v2';
import type { ParsedPage } from './html-parser';
import type { DesignTokens } from './design-extractor';

export interface BrandAnalysis {
  name: string;
  tagline: string;
  voice: {
    formality: 'casual' | 'professional' | 'formal';
    formalityScore: number;
    humorScore: number;
    technicalDepthScore: number;
    personality: string[];
    tone: string;
  };
  audience: {
    type: string;
    personas: string[];
    painPoints: string[];
  };
  industry: string;
  keyMessages: string[];
  valuePropositions: string[];
  competitiveAdvantages: string[];
  logoUrl?: string;
  socialProof: {
    testimonials: string[];
    stats: string[];
    logos: string[];
  };
}

// Zod schema for brand analysis
const BrandAnalysisSchema = z.object({
  name: z.string().describe('Company or brand name'),
  tagline: z.string().describe('Main tagline or value proposition headline'),
  voice: z.object({
    formality: z.enum(['casual', 'professional', 'formal']).describe('Level of formality in writing'),
    formalityScore: z.number().min(1).max(5).describe('1-5 score for formality based on the page copy'),
    humorScore: z.number().min(1).max(5).describe('1-5 score for humor based on the page copy'),
    technicalDepthScore: z.number().min(1).max(5).describe('1-5 score for technical depth based on the page copy'),
    personality: z.array(z.string()).describe('3-5 personality traits like innovative, trustworthy, friendly'),
    tone: z.string().describe('Overall tone description like "Confident and approachable"'),
  }),
  audience: z.object({
    type: z.string().describe('Target audience type like B2B SaaS, E-commerce consumers, Enterprise'),
    personas: z.array(z.string()).describe('2-4 specific personas like CTOs, Marketing Directors'),
    painPoints: z.array(z.string()).describe('Main pain points the audience faces'),
  }),
  industry: z.string().describe('Industry or vertical like SaaS, Fintech, Healthcare'),
  keyMessages: z.array(z.string()).describe('3-5 key marketing messages found on the page'),
  valuePropositions: z.array(z.string()).describe('Main value propositions'),
  competitiveAdvantages: z.array(z.string()).describe('Stated or implied competitive advantages'),
  socialProof: z.object({
    testimonials: z.array(z.string()).describe('Customer quotes or testimonials found'),
    stats: z.array(z.string()).describe('Statistics or metrics mentioned like "10,000+ customers"'),
    logos: z.array(z.string()).describe('Company logos or names mentioned for social proof'),
  }),
});

/**
 * Analyze brand from parsed page content
 * @param baseUrl - Page URL (used to resolve relative logo/og:image URLs)
 */
export async function analyzeBrand(
  page: ParsedPage,
  designTokens: DesignTokens,
  baseUrl?: string
): Promise<BrandAnalysis> {
  // Prepare content for analysis
  const contentForAnalysis = prepareContentForAnalysis(page);

  const prompt = `Extract detailed brand intelligence from the following page content.

PAGE TITLE: ${page.title}
PAGE DESCRIPTION: ${page.description}

HEADINGS AND COPY:
${contentForAnalysis.headings}

MAIN CONTENT:
${contentForAnalysis.mainContent}

BUTTONS AND CTAs:
${contentForAnalysis.ctas}

DESIGN OBSERVATIONS:
- Primary Color: ${designTokens.colors.primary} (${getColorMood(designTokens.colors.primary)})
- Font: ${designTokens.typography.fontFamily}
- Style: ${designTokens.corners} corners, ${designTokens.shadows} shadows

Return:
1. Company name from page evidence
2. Tagline using the brand's own wording, or "no tagline detected"
3. Voice characteristics with measurable 1-5 scores
4. Audience and pain points grounded in the copy
5. Industry, key messages, and value propositions
6. Competitive advantages only when actually stated
7. Social proof elements found on the page

Prefer boring accuracy over confident invention.`
  const fallbackAnalysis = buildFallbackBrandAnalysis(page)
  let typedAnalysis: BrandAnalysis

  try {
    const { object: analysis } = await generateObject({
      model: MODELS.BALANCED,
      schema: BrandAnalysisSchema,
      system: buildBrandExtractionSystemPrompt(),
      prompt,
      maxOutputTokens: 1600,
    })
    typedAnalysis = analysis as BrandAnalysis
  } catch (balancedError) {
    console.error('Brand analysis fell back to heuristic extraction:', balancedError)
    typedAnalysis = fallbackAnalysis
  }

  // Find logo URL (og:image, apple-touch-icon, header img, etc.)
  const logoUrl = findLogoUrl(page, baseUrl);
  
  return {
    ...typedAnalysis,
    logoUrl,
  };
}

function buildFallbackBrandAnalysis(page: ParsedPage): BrandAnalysis {
  const quickName = extractBrandNameQuick(page)
  const description = page.description?.trim() || ''
  const firstHeading = page.sections
    .flatMap((section) => {
      const match = section.html.match(/<h1[^>]*>([^<]+)<\/h1>/i)
      return match?.[1] ? [match[1].trim()] : []
    })[0]

  const tagline = description || firstHeading || `${quickName} website import`
  const pagePreview = page.textContent
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 5)

  return {
    name: quickName,
    tagline,
    voice: {
      formality: 'professional',
      formalityScore: 3,
      humorScore: 1,
      technicalDepthScore: 3,
      personality: ['clear', 'practical'],
      tone: 'Clear and product-focused',
    },
    audience: {
      type: 'Website visitors evaluating the product',
      personas: [],
      painPoints: [],
    },
    industry: 'Unknown',
    keyMessages: pagePreview,
    valuePropositions: pagePreview.slice(0, 3),
    competitiveAdvantages: [],
    socialProof: {
      testimonials: [],
      stats: [],
      logos: [],
    },
  }
}

/**
 * Prepare page content for AI analysis
 */
function prepareContentForAnalysis(page: ParsedPage): {
  headings: string;
  mainContent: string;
  ctas: string;
} {
  // Extract headings
  const headingPattern = /<h[1-6][^>]*>([^<]+)<\/h[1-6]>/gi;
  const headings: string[] = [];
  let match;
  
  page.sections.forEach(section => {
    while ((match = headingPattern.exec(section.html)) !== null) {
      const text = match[1].trim();
      if (text && text.length > 2) {
        headings.push(text);
      }
    }
  });
  
  // Extract CTAs (buttons, links with action words)
  const ctaPattern = /<(?:button|a)[^>]*>([^<]+)<\/(?:button|a)>/gi;
  const ctas: string[] = [];
  
  page.sections.forEach(section => {
    while ((match = ctaPattern.exec(section.html)) !== null) {
      const text = match[1].trim();
      if (text && text.length > 2 && text.length < 50) {
        ctas.push(text);
      }
    }
  });
  
  // Get main content (limit to avoid token limits)
  const mainContent = page.textContent.slice(0, 6000);
  
  return {
    headings: headings.slice(0, 20).join('\n'),
    mainContent,
    ctas: [...new Set(ctas)].slice(0, 15).join(', '),
  };
}

/**
 * Get mood/feeling from color
 */
function getColorMood(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  
  // Simple color mood mapping
  if (b > r && b > g) {
    if (b > 180) return 'trustworthy, calm';
    return 'professional, reliable';
  }
  if (r > g && r > b) {
    if (r > 200) return 'energetic, urgent';
    return 'bold, passionate';
  }
  if (g > r && g > b) {
    return 'growth, natural, sustainable';
  }
  if (r > 200 && g > 150 && b < 100) {
    return 'optimistic, warm, friendly';
  }
  if (r > 150 && g < 100 && b > 150) {
    return 'creative, luxurious, innovative';
  }
  
  return 'modern, neutral';
}

/**
 * Resolve a possibly relative URL against baseUrl
 */
function resolveLogoUrl(url: string | undefined, baseUrl: string | undefined): string | undefined {
  if (!url || !url.startsWith('http')) {
    if (!baseUrl || !url) return url || undefined;
    try {
      return new URL(url, baseUrl).toString();
    } catch {
      return undefined;
    }
  }
  return url;
}

/**
 * Find logo URL from page (og:image, apple-touch-icon, header img, favicon)
 */
function findLogoUrl(page: ParsedPage, baseUrl?: string): string | undefined {
  // 1. Open Graph image (often logo or hero; high quality)
  const ogImage = page.ogTags?.['image'];
  if (ogImage) {
    const resolved = resolveLogoUrl(ogImage, baseUrl);
    if (resolved) return resolved;
  }

  // 2. Header section img with logo in class/id/alt
  const headerSection = page.sections.find(s => s.type === 'header');
  if (headerSection) {
    const logoMatch = headerSection.html.match(
      /<img[^>]*(?:class|id|alt)[^>]*logo[^>]*src=["']([^"']+)["']/i
    ) || headerSection.html.match(
      /<img[^>]*src=["']([^"']+)["'][^>]*(?:class|id|alt)[^>]*logo/i
    );
    if (logoMatch) {
      return resolveLogoUrl(logoMatch[1], baseUrl);
    }
  }

  // 3. Assets: images with "logo" in URL
  const logoPatterns = [/logo/i, /brand/i, /mark/i];
  for (const img of page.assets.images.slice(0, 10)) {
    if (logoPatterns.some(p => p.test(img))) {
      return img;
    }
  }

  // 4. Apple touch icon (often the app/logo icon)
  if (page.assets.icons.length > 0) {
    const appleTouch = page.assets.icons.find(u => /apple-touch|icon-?\d+x\d+/i.test(u));
    return appleTouch || page.assets.icons[0];
  }

  return undefined;
}

/**
 * Quick brand name extraction (without full AI analysis)
 */
export function extractBrandNameQuick(page: ParsedPage): string {
  // Try title first
  if (page.title) {
    // Remove common suffixes
    const cleaned = page.title
      .replace(/\s*[-|–—:]\s*.+$/, '') // Remove "- Company Name" patterns
      .replace(/\s*\|\s*.+$/, '')
      .trim();
    
    if (cleaned.length > 1 && cleaned.length < 50) {
      return cleaned;
    }
  }
  
  // Try OG site name
  if (page.ogTags.site_name) {
    return page.ogTags.site_name;
  }
  
  // Try first H1
  const h1Match = page.sanitizedHtml.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  if (h1Match) {
    const h1Text = h1Match[1].trim();
    if (h1Text.length < 30) {
      return h1Text;
    }
  }
  
  return 'Unknown Brand';
}

/**
 * Extract quick metrics from page for summary
 */
export function extractQuickMetrics(page: ParsedPage): {
  sectionCount: number;
  wordCount: number;
  imageCount: number;
  hasTestimonials: boolean;
  hasPricing: boolean;
  hasFaq: boolean;
  hasForm: boolean;
} {
  const hasTestimonials = page.sections.some(s => s.type === 'testimonials');
  const hasPricing = page.sections.some(s => s.type === 'pricing');
  const hasFaq = page.sections.some(s => s.type === 'faq');
  const hasForm = page.sections.some(s => s.hasForm);
  
  return {
    sectionCount: page.sections.length,
    wordCount: page.textContent.split(/\s+/).length,
    imageCount: page.assets.images.length,
    hasTestimonials,
    hasPricing,
    hasFaq,
    hasForm,
  };
}

/**
 * Generate brand context from analysis (for use in generation)
 */
export function brandAnalysisToBrandContext(
  analysis: BrandAnalysis,
  designTokens: DesignTokens
) {
  return {
    name: analysis.name,
    tagline: analysis.tagline,
    targetAudience: analysis.audience.type,
    industry: analysis.industry,
    colors: {
      primary: designTokens.colors.primary,
      secondary: designTokens.colors.secondary,
      accent: designTokens.colors.accent,
      background: designTokens.colors.background,
      text: designTokens.colors.text,
    },
    typography: {
      fontFamily: designTokens.typography.fontFamily,
      fontHeading: designTokens.typography.fontHeading,
      fontMono: 'monospace',
      fontCdnUrl: designTokens.typography.fontUrl,
    },
    voice: {
      tone: analysis.voice.tone,
      attributes: analysis.voice.personality,
      scores: {
        formality: analysis.voice.formalityScore,
        humor: analysis.voice.humorScore,
        technicalDepth: analysis.voice.technicalDepthScore,
      },
    },
    messaging: {
      keyMessages: analysis.keyMessages,
      valuePropositions: analysis.valuePropositions,
      boilerplate: analysis.tagline,
      differentiators: analysis.competitiveAdvantages,
    },
    visualStyle: {
      theme: designTokens.colors.background === '#ffffff' ? 'light' : 'dark',
      corners: designTokens.corners,
      shadows: designTokens.shadows,
    },
    guidelines: {
      dos: analysis.competitiveAdvantages.map(a => `Highlight: ${a}`),
      donts: [],
    },
    claims: {
      approved: [],
      risky: [],
    },
  };
}
