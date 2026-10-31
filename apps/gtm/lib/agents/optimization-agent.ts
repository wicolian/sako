/**
 * Optimization Agent (Phase 1.6)
 * 
 * SEO-focused agent for content optimization.
 * One of three named specialist agents (Optimization, Personalization, Research).
 */

import { generateObject, generateText } from '@/lib/ai/langsmith-ai'
import { z } from 'zod'
import { MODELS } from '@/lib/ai/ai-sdk-client'

// Tool schemas
const seoAnalysisSchema = z.object({
  overall_score: z.number().min(0).max(100).describe('Overall SEO score'),
  keyword_density: z.object({
    score: z.number(),
    found_keywords: z.array(z.string()),
    missing_keywords: z.array(z.string()),
    recommendations: z.array(z.string()),
  }),
  readability: z.object({
    score: z.number(),
    grade_level: z.string(),
    sentence_length_avg: z.number(),
    recommendations: z.array(z.string()),
  }),
  structure: z.object({
    score: z.number(),
    has_h1: z.boolean(),
    heading_hierarchy: z.boolean(),
    paragraph_length: z.string(),
    recommendations: z.array(z.string()),
  }),
  improvements: z.array(z.object({
    priority: z.enum(['high', 'medium', 'low']),
    issue: z.string(),
    fix: z.string(),
  })),
})

const metaTagsSchema = z.object({
  title: z.string().max(60).describe('SEO title tag'),
  description: z.string().max(160).describe('Meta description'),
  og_title: z.string().describe('Open Graph title'),
  og_description: z.string().describe('Open Graph description'),
  twitter_title: z.string().describe('Twitter card title'),
  twitter_description: z.string().describe('Twitter card description'),
  keywords: z.array(z.string()).describe('Meta keywords'),
})

const internalLinksSchema = z.object({
  suggestions: z.array(z.object({
    anchor_text: z.string(),
    target_url: z.string(),
    context: z.string().describe('Where in the content to place this link'),
    relevance_score: z.number().min(0).max(100),
  })),
  total_links_recommended: z.number(),
})

const contentOptimizationSchema = z.object({
  optimized_content: z.string(),
  changes_made: z.array(z.object({
    type: z.enum(['keyword_insertion', 'readability', 'structure', 'heading', 'cta']),
    original: z.string(),
    optimized: z.string(),
    reason: z.string(),
  })),
  improvement_percentage: z.number(),
})

export type SEOAnalysis = z.infer<typeof seoAnalysisSchema>
export type MetaTags = z.infer<typeof metaTagsSchema>
export type InternalLinkSuggestions = z.infer<typeof internalLinksSchema>
export type ContentOptimization = z.infer<typeof contentOptimizationSchema>

/**
 * Optimization Agent Tools
 */
export const optimizationAgentTools = {
  /**
   * Analyze content for SEO optimization opportunities
   */
  analyze_seo: {
    name: 'analyze_seo',
    description: 'Analyze content for SEO optimization opportunities',
    parameters: z.object({
      content: z.string().describe('The content to analyze'),
      targetKeywords: z.array(z.string()).describe('Target keywords to optimize for'),
      contentType: z.enum(['landing_page', 'blog_post', 'product_page', 'email']).optional(),
    }),
    execute: async ({ content, targetKeywords, contentType = 'landing_page' }: { content: string; targetKeywords: string[]; contentType?: string }): Promise<SEOAnalysis> => {
      const { object } = await generateObject({
        model: MODELS.STRUCTURED,
        schema: seoAnalysisSchema,
        system: `You are an SEO expert analyzing content for optimization opportunities.

Content Type: ${contentType}
Target Keywords: ${targetKeywords.join(', ')}

Analyze the content thoroughly and provide:
1. Overall SEO score (0-100)
2. Keyword density analysis
3. Readability assessment
4. Structure evaluation
5. Prioritized list of improvements`,
        prompt: `Analyze this content:\n\n${content}`,
        temperature: 0.3,
      })

      return object as SEOAnalysis
    },
  },

  /**
   * Generate SEO meta title and description
   */
  generate_meta: {
    name: 'generate_meta',
    description: 'Generate SEO meta title and description',
    parameters: z.object({
      pageContent: z.string().describe('The page content to generate meta tags for'),
      primaryKeyword: z.string().describe('Primary keyword to target'),
      brandName: z.string().optional().describe('Brand name to include'),
    }),
    execute: async ({ pageContent, primaryKeyword, brandName }: { pageContent: string; primaryKeyword: string; brandName?: string }): Promise<MetaTags> => {
      const { object } = await generateObject({
        model: MODELS.STRUCTURED,
        schema: metaTagsSchema,
        system: `You are an SEO specialist creating compelling meta tags.

Primary Keyword: ${primaryKeyword}
${brandName ? `Brand: ${brandName}` : ''}

Create meta tags that:
- Include the primary keyword naturally
- Are compelling and click-worthy
- Stay within character limits (title: 60, description: 160)
- Work well for both search and social sharing`,
        prompt: `Generate meta tags for this content:\n\n${pageContent.substring(0, 2000)}...`,
        temperature: 0.5,
      })

      return object as MetaTags
    },
  },

  /**
   * Suggest internal linking opportunities
   */
  suggest_internal_links: {
    name: 'suggest_internal_links',
    description: 'Suggest internal linking opportunities',
    parameters: z.object({
      content: z.string().describe('The content to add links to'),
      sitePages: z.array(z.object({
        url: z.string(),
        title: z.string(),
        description: z.string().optional(),
      })).describe('Available pages on the site'),
    }),
    execute: async ({ content, sitePages }: { content: string; sitePages: Array<{ url: string; title: string; description?: string }> }): Promise<InternalLinkSuggestions> => {
      const pagesContext = sitePages
        .map(p => `- ${p.title}: ${p.url}${p.description ? ` (${p.description})` : ''}`)
        .join('\n')

      const { object } = await generateObject({
        model: MODELS.STRUCTURED,
        schema: internalLinksSchema,
        system: `You are an SEO expert suggesting internal linking opportunities.

Available pages to link to:
${pagesContext}

Suggest natural internal links that:
- Use relevant anchor text (not "click here")
- Link to contextually relevant pages
- Don't over-optimize or stuff links
- Improve user navigation and SEO`,
        prompt: `Suggest internal links for this content:\n\n${content}`,
        temperature: 0.4,
      })

      return object as InternalLinkSuggestions
    },
  },

  /**
   * Optimize content for SEO
   */
  optimize_content: {
    name: 'optimize_content',
    description: 'Automatically optimize content for better SEO',
    parameters: z.object({
      content: z.string().describe('The content to optimize'),
      targetKeywords: z.array(z.string()).describe('Keywords to optimize for'),
      preserveTone: z.boolean().default(true).describe('Preserve the original tone'),
    }),
    execute: async ({ content, targetKeywords, preserveTone }: { content: string; targetKeywords: string[]; preserveTone?: boolean }): Promise<ContentOptimization> => {
      const { object } = await generateObject({
        model: MODELS.CREATIVE,
        schema: contentOptimizationSchema,
        system: `You are an SEO copywriter optimizing content for search.

Target Keywords: ${targetKeywords.join(', ')}
Preserve Original Tone: ${preserveTone ? 'Yes' : 'No'}

Optimize the content by:
- Naturally incorporating target keywords
- Improving readability
- Enhancing structure with proper headings
- Adding CTAs where appropriate
- Keeping the content engaging and natural`,
        prompt: `Optimize this content:\n\n${content}`,
        temperature: 0.6,
      })

      return object as ContentOptimization
    },
  },

  /**
   * Generate heading suggestions
   */
  suggest_headings: {
    name: 'suggest_headings',
    description: 'Suggest optimized headings for content',
    parameters: z.object({
      content: z.string().describe('The content to create headings for'),
      targetKeyword: z.string().describe('Primary keyword'),
    }),
    execute: async ({ content, targetKeyword }: { content: string; targetKeyword: string }): Promise<{
      h1: string
      h2s: string[]
      h3s: string[]
    }> => {
      const { object } = await generateObject({
        model: MODELS.STRUCTURED,
        schema: z.object({
          h1: z.string().describe('Main H1 heading'),
          h2s: z.array(z.string()).describe('H2 subheadings'),
          h3s: z.array(z.string()).describe('H3 subheadings'),
        }),
        system: `You are an SEO expert creating heading structures.

Target Keyword: ${targetKeyword}

Create headings that:
- Include target keyword in H1
- Create logical hierarchy
- Are scannable and descriptive
- Support the content structure`,
        prompt: `Create heading suggestions for:\n\n${content.substring(0, 3000)}`,
        temperature: 0.5,
      })

      return object as { h1: string; h2s: string[]; h3s: string[] }
    },
  },

  /**
   * Check for duplicate content issues
   */
  check_originality: {
    name: 'check_originality',
    description: 'Check content for potential duplicate content issues',
    parameters: z.object({
      content: z.string().describe('The content to check'),
    }),
    execute: async ({ content }: { content: string }): Promise<{
      originality_score: number
      potential_issues: string[]
      recommendations: string[]
    }> => {
      const { object } = await generateObject({
        model: MODELS.STRUCTURED,
        schema: z.object({
          originality_score: z.number().min(0).max(100),
          potential_issues: z.array(z.string()),
          recommendations: z.array(z.string()),
        }),
        system: `You are checking content for originality and duplicate content issues.

Analyze for:
- Generic/boilerplate language
- Common phrases that might appear elsewhere
- Areas that could be more unique
- Opportunities for differentiation`,
        prompt: `Check this content for originality:\n\n${content}`,
        temperature: 0.3,
      })

      return object as { originality_score: number; potential_issues: string[]; recommendations: string[] }
    },
  },
}

/**
 * Run the optimization agent on content
 */
export async function runOptimizationAgent(
  content: string,
  options: {
    targetKeywords: string[]
    sitePages?: Array<{ url: string; title: string; description?: string }>
    autoOptimize?: boolean
  }
): Promise<{
  analysis: SEOAnalysis
  metaTags: MetaTags
  internalLinks?: InternalLinkSuggestions
  optimizedContent?: ContentOptimization
}> {
  // Run SEO analysis
  const analysis = await optimizationAgentTools.analyze_seo.execute({
    content,
    targetKeywords: options.targetKeywords,
  })

  // Generate meta tags
  const metaTags = await optimizationAgentTools.generate_meta.execute({
    pageContent: content,
    primaryKeyword: options.targetKeywords[0],
  })

  // Suggest internal links if pages provided
  let internalLinks: InternalLinkSuggestions | undefined
  if (options.sitePages && options.sitePages.length > 0) {
    internalLinks = await optimizationAgentTools.suggest_internal_links.execute({
      content,
      sitePages: options.sitePages,
    })
  }

  // Auto-optimize if requested
  let optimizedContent: ContentOptimization | undefined
  if (options.autoOptimize) {
    optimizedContent = await optimizationAgentTools.optimize_content.execute({
      content,
      targetKeywords: options.targetKeywords,
      preserveTone: true,
    })
  }

  return {
    analysis,
    metaTags,
    internalLinks,
    optimizedContent,
  }
}
