/**
 * Personalization Agent (Phase 1.6)
 * 
 * CRM integration agent for segment-specific content generation.
 * One of three named specialist agents (Optimization, Personalization, Research).
 */

import { generateObject } from '@/lib/ai/langsmith-ai'
import { z } from 'zod'
import { MODELS } from '@/lib/ai/ai-sdk-client'
import { createServiceClient } from '@/lib/supabase/service'

// Types
export interface ContactSegment {
  id: string
  name: string
  criteria: Record<string, unknown>
  contactCount: number
  characteristics?: {
    avgDealSize?: number
    avgSalesCycle?: number
    topIndustries?: string[]
    topJobTitles?: string[]
    commonPainPoints?: string[]
  }
}

export interface PersonalizedContent {
  segmentId: string
  segmentName: string
  headline: string
  body: string
  cta: string
  personalizationTokens: Record<string, string>
  confidenceScore: number
}

// Schemas
const segmentAnalysisSchema = z.object({
  segments: z.array(z.object({
    id: z.string(),
    name: z.string(),
    size: z.number(),
    engagement_score: z.number().min(0).max(100),
    recommended_approach: z.string(),
    key_pain_points: z.array(z.string()),
    content_preferences: z.array(z.string()),
  })),
  overall_recommendations: z.array(z.string()),
})

const personalizedContentSchema = z.object({
  variations: z.array(z.object({
    segment_id: z.string(),
    segment_name: z.string(),
    headline: z.string(),
    subheadline: z.string(),
    body: z.string(),
    cta_text: z.string(),
    cta_urgency: z.enum(['low', 'medium', 'high']),
    personalization_strategy: z.string(),
    confidence_score: z.number().min(0).max(100),
  })),
})

const emailPersonalizationSchema = z.object({
  subject_lines: z.array(z.object({
    segment_id: z.string(),
    subject: z.string(),
    preview_text: z.string(),
    personalization_used: z.array(z.string()),
  })),
  body_variations: z.array(z.object({
    segment_id: z.string(),
    opening: z.string(),
    body: z.string(),
    closing: z.string(),
    ps_line: z.string().optional(),
  })),
})

/**
 * Personalization Agent Tools
 */
export const personalizationAgentTools = {
  /**
   * Analyze segments for personalization opportunities
   */
  analyze_segments: {
    name: 'analyze_segments',
    description: 'Analyze customer segments for personalization opportunities',
    parameters: z.object({
      segments: z.array(z.object({
        id: z.string(),
        name: z.string(),
        criteria: z.record(z.unknown()),
        contactCount: z.number(),
      })),
      campaignGoal: z.string(),
    }),
    execute: async ({ segments, campaignGoal }: { segments: Array<{ id: string; name: string; criteria: Record<string, unknown>; contactCount: number }>; campaignGoal: string }) => {
      const segmentContext = segments
        .map(s => `- ${s.name} (${s.contactCount} contacts): ${JSON.stringify(s.criteria)}`)
        .join('\n')

      const { object } = await generateObject({
        model: MODELS.STRUCTURED,
        schema: segmentAnalysisSchema,
        system: `You are a marketing personalization expert analyzing customer segments.

Campaign Goal: ${campaignGoal}

Analyze each segment and provide:
1. Engagement potential score
2. Recommended messaging approach
3. Key pain points to address
4. Content format preferences`,
        prompt: `Analyze these segments:\n\n${segmentContext}`,
        temperature: 0.4,
      })

      return object as { segments: { name: string; id: string; size: number; engagement_score: number; recommended_approach: string; key_pain_points: string[]; content_preferences: string[] }[]; overall_recommendations: string[] }
    },
  },

  /**
   * Generate personalized content variations
   */
  generate_personalized_content: {
    name: 'generate_personalized_content',
    description: 'Generate personalized content for different segments',
    parameters: z.object({
      baseContent: z.string(),
      segments: z.array(z.object({
        id: z.string(),
        name: z.string(),
        painPoints: z.array(z.string()),
        goals: z.array(z.string()),
      })),
      contentType: z.enum(['landing_page', 'email', 'ad', 'social']),
    }),
    execute: async ({ baseContent, segments, contentType }: { baseContent: string; segments: Array<{ id: string; name: string; painPoints: string[]; goals: string[] }>; contentType: 'landing_page' | 'email' | 'ad' | 'social' }) => {
      const { object } = await generateObject({
        model: MODELS.CREATIVE,
        schema: personalizedContentSchema,
        system: `You are a personalization specialist creating segment-specific content variations.

Content Type: ${contentType}

Create variations that:
- Address each segment's specific pain points
- Use language that resonates with their goals
- Maintain brand consistency while personalizing
- Feel authentic, not overly automated`,
        prompt: `Base Content:\n${baseContent}\n\nSegments:\n${JSON.stringify(segments, null, 2)}`,
        temperature: 0.7,
      })

      return object as { variations: { segment_id: string; segment_name: string; headline: string; subheadline: string; body: string; cta_text: string; cta_urgency: 'low' | 'medium' | 'high'; personalization_strategy: string; confidence_score: number }[] }
    },
  },

  /**
   * Generate personalized email variations
   */
  personalize_email: {
    name: 'personalize_email',
    description: 'Create personalized email variations for segments',
    parameters: z.object({
      emailTemplate: z.string(),
      segments: z.array(z.object({
        id: z.string(),
        name: z.string(),
        characteristics: z.record(z.unknown()),
      })),
      availableTokens: z.array(z.string()).describe('Available personalization tokens like first_name, company'),
    }),
    execute: async ({ emailTemplate, segments, availableTokens }: { emailTemplate: string; segments: Array<{ id: string; name: string; characteristics: Record<string, unknown> }>; availableTokens: string[] }) => {
      const { object } = await generateObject({
        model: MODELS.CREATIVE,
        schema: emailPersonalizationSchema,
        system: `You are an email marketing expert creating personalized email variations.

Available Personalization Tokens: ${availableTokens.join(', ')}

Create email variations that:
- Use personalization tokens naturally
- Adapt tone for each segment
- Maintain high deliverability (avoid spam triggers)
- Drive opens and clicks`,
        prompt: `Email Template:\n${emailTemplate}\n\nSegments:\n${JSON.stringify(segments, null, 2)}`,
        temperature: 0.7,
      })

      return object as { subject_lines: { segment_id: string; subject: string; preview_text: string; personalization_used: string[] }[]; body_variations: { segment_id: string; opening: string; body: string; closing: string; ps_line?: string }[] }
    },
  },

  /**
   * Recommend best segment for content
   */
  recommend_segment: {
    name: 'recommend_segment',
    description: 'Recommend the best segment for a piece of content',
    parameters: z.object({
      content: z.string(),
      availableSegments: z.array(z.object({
        id: z.string(),
        name: z.string(),
        description: z.string(),
      })),
    }),
    execute: async ({ content, availableSegments }: { content: string; availableSegments: Array<{ id: string; name: string; description: string }> }) => {
      const { object } = await generateObject({
        model: MODELS.STRUCTURED,
        schema: z.object({
          recommended_segment: z.object({
            id: z.string(),
            name: z.string(),
            match_score: z.number().min(0).max(100),
            reasoning: z.string(),
          }),
          secondary_segments: z.array(z.object({
            id: z.string(),
            name: z.string(),
            match_score: z.number(),
            adaptation_needed: z.string(),
          })),
        }),
        system: `You are matching content to customer segments.

Analyze the content and recommend:
1. The best-fit segment
2. Secondary segments with adaptations needed`,
        prompt: `Content:\n${content}\n\nSegments:\n${JSON.stringify(availableSegments, null, 2)}`,
        temperature: 0.3,
      })

      return object as { recommended_segment: { id: string; name: string; match_score: number; reasoning: string }; secondary_segments: { id: string; name: string; match_score: number; adaptation_needed: string }[] }
    },
  },

  /**
   * Generate dynamic content rules
   */
  generate_dynamic_rules: {
    name: 'generate_dynamic_rules',
    description: 'Generate dynamic content rules for personalization',
    parameters: z.object({
      contentBlocks: z.array(z.object({
        id: z.string(),
        content: z.string(),
        type: z.string(),
      })),
      segments: z.array(z.object({
        id: z.string(),
        name: z.string(),
        criteria: z.record(z.unknown()),
      })),
    }),
    execute: async ({ contentBlocks, segments }: { contentBlocks: Array<{ id: string; content: string; type: string }>; segments: Array<{ id: string; name: string; criteria: Record<string, unknown> }> }) => {
      const { object } = await generateObject({
        model: MODELS.STRUCTURED,
        schema: z.object({
          rules: z.array(z.object({
            block_id: z.string(),
            segment_id: z.string(),
            show: z.boolean(),
            replace_with: z.string().optional(),
            priority: z.number(),
          })),
          default_experience: z.string().describe('Which segment gets the default experience'),
        }),
        system: `You are creating dynamic content rules for website personalization.

Create rules that:
- Show relevant content to each segment
- Define clear priorities for overlapping segments
- Include fallback/default behavior`,
        prompt: `Content Blocks:\n${JSON.stringify(contentBlocks, null, 2)}\n\nSegments:\n${JSON.stringify(segments, null, 2)}`,
        temperature: 0.3,
      })

      return object as { rules: { block_id: string; segment_id: string; show: boolean; replace_with?: string; priority: number }[]; default_experience: string }
    },
  },
}

/**
 * Get HubSpot segments for a workspace
 */
export async function getHubSpotSegments(workspaceId: string): Promise<ContactSegment[]> {
  const supabase = createServiceClient()

  const { data: lists, error } = await supabase
    .from('hubspot_lists')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('is_available_for_targeting', true)

  if (error || !lists) {
    return []
  }

  return lists.map(list => ({
    id: list.hubspot_list_id,
    name: list.name,
    criteria: {},
    contactCount: list.contact_count || 0,
  }))
}

/**
 * Run the personalization agent
 */
export async function runPersonalizationAgent(
  workspaceId: string,
  content: string,
  options: {
    contentType: 'landing_page' | 'email' | 'ad' | 'social'
    useHubSpotSegments?: boolean
    customSegments?: ContactSegment[]
    campaignGoal?: string
  }
): Promise<{
  analysis: z.infer<typeof segmentAnalysisSchema>
  personalizedContent: z.infer<typeof personalizedContentSchema>
}> {
  // Get segments
  let segments: ContactSegment[] = options.customSegments || []

  if (options.useHubSpotSegments) {
    const hubspotSegments = await getHubSpotSegments(workspaceId)
    segments = [...segments, ...hubspotSegments]
  }

  if (segments.length === 0) {
    throw new Error('No segments available for personalization')
  }

  // Analyze segments
  const analysis = await personalizationAgentTools.analyze_segments.execute({
    segments: segments.map(s => ({
      id: s.id,
      name: s.name,
      criteria: s.criteria,
      contactCount: s.contactCount,
    })),
    campaignGoal: options.campaignGoal || 'Drive engagement and conversions',
  })

  // Generate personalized content
  const personalizedContent = await personalizationAgentTools.generate_personalized_content.execute({
    baseContent: content,
    segments: segments.map(s => ({
      id: s.id,
      name: s.name,
      painPoints: s.characteristics?.commonPainPoints || [],
      goals: [],
    })),
    contentType: options.contentType,
  })

  return {
    analysis,
    personalizedContent,
  }
}
