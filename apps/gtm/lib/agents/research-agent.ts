/**
 * Research Agent (Phase 1.6)
 * 
 * Deep research agent for competitive analysis and market research.
 * One of three named specialist agents (Optimization, Personalization, Reseimport { Database } from '@/lib/supabase/types'

type EvidenceRow = Database['public']['Tables']['evidence']['Row']
arch).
 * Formalizes existing evidence-researcher.ts functionality.
 */

import { generateObject, generateText } from '@/lib/ai/langsmith-ai'
import { z } from 'zod'
import { MODELS } from '@/lib/ai/ai-sdk-client'
import { createServiceClient } from '@/lib/supabase/service'

// Schemas
const competitorAnalysisSchema = z.object({
  competitors: z.array(z.object({
    name: z.string(),
    website: z.string().optional(),
    positioning: z.string(),
    key_messages: z.array(z.string()),
    strengths: z.array(z.string()),
    weaknesses: z.array(z.string()),
    pricing_model: z.string().optional(),
    target_audience: z.string(),
    unique_selling_points: z.array(z.string()),
  })),
  market_gaps: z.array(z.string()),
  differentiation_opportunities: z.array(z.string()),
  competitive_threats: z.array(z.string()),
})

const marketTrendSchema = z.object({
  trends: z.array(z.object({
    name: z.string(),
    description: z.string(),
    relevance_score: z.number().min(0).max(100),
    timeframe: z.enum(['emerging', 'growing', 'mature', 'declining']),
    impact_areas: z.array(z.string()),
    opportunities: z.array(z.string()),
    threats: z.array(z.string()),
  })),
  industry_outlook: z.string(),
  recommended_actions: z.array(z.string()),
})

const researchBriefSchema = z.object({
  executive_summary: z.string(),
  key_findings: z.array(z.object({
    finding: z.string(),
    evidence: z.string(),
    confidence: z.enum(['high', 'medium', 'low']),
    source_type: z.string(),
  })),
  recommendations: z.array(z.object({
    recommendation: z.string(),
    priority: z.enum(['high', 'medium', 'low']),
    rationale: z.string(),
    expected_impact: z.string(),
  })),
  further_research_needed: z.array(z.string()),
})

const audienceInsightsSchema = z.object({
  segments: z.array(z.object({
    name: z.string(),
    size_estimate: z.string(),
    demographics: z.record(z.string()),
    psychographics: z.record(z.string()),
    behaviors: z.array(z.string()),
    pain_points: z.array(z.string()),
    buying_journey: z.string(),
    preferred_channels: z.array(z.string()),
  })),
  total_addressable_market: z.string(),
  growth_segments: z.array(z.string()),
})

export type CompetitorAnalysis = z.infer<typeof competitorAnalysisSchema>
export type MarketTrends = z.infer<typeof marketTrendSchema>
export type ResearchBrief = z.infer<typeof researchBriefSchema>
export type AudienceInsights = z.infer<typeof audienceInsightsSchema>

// Tool parameter types
interface AnalyzeCompetitorsParams {
  industry: string
  competitors: string[]
  ourProduct: string
  focusAreas?: string[]
}

interface ResearchTrendsParams {
  industry: string
  timeframe: '6_months' | '1_year' | '2_years' | '5_years'
  specificTopics?: string[]
}

interface ResearchAudienceParams {
  productDescription: string
  industry: string
  currentAudience?: string
  geographies?: string[]
}

interface ValidateClaimParams {
  claim: string
  industry: string
}

interface GenerateBattleCardParams {
  competitor: string
  ourProduct: string
  ourStrengths: string[]
}

interface GenerateResearchBriefParams {
  topic: string
  findings: Array<{
    source: string
    content: string
    date?: string
  }>
  businessContext: string
}

/**
 * Research Agent Tools
 */
export const researchAgentTools = {
  /**
   * Analyze competitors in a market
   */
  analyze_competitors: {
    name: 'analyze_competitors',
    description: 'Conduct competitive analysis',
    parameters: z.object({
      industry: z.string().describe('Industry or market'),
      competitors: z.array(z.string()).describe('Known competitor names'),
      ourProduct: z.string().describe('Description of our product/service'),
      focusAreas: z.array(z.string()).optional().describe('Specific areas to analyze'),
    }),
    execute: async ({ industry, competitors, ourProduct, focusAreas }: AnalyzeCompetitorsParams): Promise<CompetitorAnalysis> => {
      const { object } = await generateObject({
        model: MODELS.REASONING,
        schema: competitorAnalysisSchema,
        system: `You are a competitive intelligence analyst conducting thorough market research.

Industry: ${industry}
Our Product: ${ourProduct}
${focusAreas ? `Focus Areas: ${focusAreas.join(', ')}` : ''}

Analyze competitors and identify:
1. Their positioning and key messages
2. Strengths and weaknesses
3. Market gaps and opportunities
4. Competitive threats to watch`,
        prompt: `Analyze these competitors: ${competitors.join(', ')}`,
        temperature: 0.4,
      })

      return object as CompetitorAnalysis
    },
  },

  /**
   * Research market trends
   */
  research_trends: {
    name: 'research_trends',
    description: 'Research market trends and industry developments',
    parameters: z.object({
      industry: z.string(),
      timeframe: z.enum(['6_months', '1_year', '2_years', '5_years']),
      specificTopics: z.array(z.string()).optional(),
    }),
    execute: async ({ industry, timeframe, specificTopics }: ResearchTrendsParams): Promise<MarketTrends> => {
      const { object } = await generateObject({
        model: MODELS.REASONING,
        schema: marketTrendSchema,
        system: `You are a market research analyst identifying trends and opportunities.

Industry: ${industry}
Timeframe: ${timeframe}
${specificTopics ? `Focus Topics: ${specificTopics.join(', ')}` : ''}

Identify trends that are:
- Relevant to the industry
- Actionable for businesses
- Backed by observable market signals`,
        prompt: `What are the key trends in ${industry} over the next ${timeframe.replace('_', ' ')}?`,
        temperature: 0.5,
      })

      return object as MarketTrends
    },
  },

  /**
   * Generate research brief from findings
   */
  generate_research_brief: {
    name: 'generate_research_brief',
    description: 'Compile research into an actionable brief',
    parameters: z.object({
      topic: z.string(),
      findings: z.array(z.object({
        source: z.string(),
        content: z.string(),
        date: z.string().optional(),
      })),
      businessContext: z.string().describe('What the business is trying to achieve'),
    }),
    execute: async ({ topic, findings, businessContext }: GenerateResearchBriefParams): Promise<ResearchBrief> => {
      const findingsText = findings
        .map(f => `[${f.source}${f.date ? ` - ${f.date}` : ''}]: ${f.content}`)
        .join('\n\n')

      const { object } = await generateObject({
        model: MODELS.REASONING,
        schema: researchBriefSchema,
        system: `You are a research analyst creating an executive brief.

Topic: ${topic}
Business Context: ${businessContext}

Create a brief that:
- Synthesizes findings into actionable insights
- Prioritizes recommendations by impact
- Notes confidence levels and gaps`,
        prompt: `Research Findings:\n\n${findingsText}`,
        temperature: 0.4,
      })

      return object as ResearchBrief
    },
  },

  /**
   * Research audience insights
   */
  research_audience: {
    name: 'research_audience',
    description: 'Research and segment target audience',
    parameters: z.object({
      productDescription: z.string(),
      currentAudience: z.string().optional(),
      industry: z.string(),
      geographies: z.array(z.string()).optional(),
    }),
    execute: async ({ productDescription, currentAudience, industry, geographies }: ResearchAudienceParams): Promise<AudienceInsights> => {
      const { object } = await generateObject({
        model: MODELS.REASONING,
        schema: audienceInsightsSchema,
        system: `You are an audience research specialist identifying target segments.

Product: ${productDescription}
Industry: ${industry}
${currentAudience ? `Current Audience: ${currentAudience}` : ''}
${geographies ? `Geographies: ${geographies.join(', ')}` : ''}

Identify audience segments with:
- Clear demographics and psychographics
- Specific pain points and needs
- Buying behaviors and preferences`,
        prompt: `Who are the best potential customers for this product?`,
        temperature: 0.5,
      })

      return object as AudienceInsights
    },
  },

  /**
   * Validate claims with research
   */
  validate_claim_with_research: {
    name: 'validate_claim_with_research',
    description: 'Research to validate or support a marketing claim',
    parameters: z.object({
      claim: z.string(),
      industry: z.string(),
    }),
    execute: async ({ claim, industry }: ValidateClaimParams) => {
      const { object } = await generateObject({
        model: MODELS.REASONING,
        schema: z.object({
          claim: z.string(),
          validity: z.enum(['supported', 'partially_supported', 'unsupported', 'needs_more_research']),
          supporting_evidence: z.array(z.object({
            evidence: z.string(),
            source_type: z.string(),
            strength: z.enum(['strong', 'moderate', 'weak']),
          })),
          contradicting_evidence: z.array(z.string()),
          recommended_revision: z.string().optional(),
          confidence_score: z.number().min(0).max(100),
        }),
        system: `You are a research analyst validating marketing claims.

Industry: ${industry}

Evaluate if this claim can be supported with evidence and research.`,
        prompt: `Validate this claim: "${claim}"`,
        temperature: 0.3,
      })

      return object as { claim: string; validity: 'supported' | 'partially_supported' | 'unsupported' | 'needs_more_research'; supporting_evidence: { evidence: string; source_type: string; strength: 'strong' | 'moderate' | 'weak' }[]; contradicting_evidence: string[]; recommended_revision?: string; confidence_score: number }
    },
  },

  /**
   * Generate battle card
   */
  generate_battle_card: {
    name: 'generate_battle_card',
    description: 'Generate a sales battle card for a competitor',
    parameters: z.object({
      competitor: z.string(),
      ourProduct: z.string(),
      ourStrengths: z.array(z.string()),
    }),
    execute: async ({ competitor, ourProduct, ourStrengths }: GenerateBattleCardParams) => {
      const { object } = await generateObject({
        model: MODELS.CREATIVE,
        schema: z.object({
          competitor_name: z.string(),
          quick_summary: z.string().describe('2-3 sentence summary'),
          their_pitch: z.string().describe('How they position themselves'),
          our_differentiation: z.array(z.object({
            area: z.string(),
            their_approach: z.string(),
            our_approach: z.string(),
            talk_track: z.string(),
          })),
          common_objections: z.array(z.object({
            objection: z.string(),
            response: z.string(),
          })),
          when_we_win: z.array(z.string()),
          when_we_lose: z.array(z.string()),
          landmines: z.array(z.string()).describe('Questions to ask that expose their weaknesses'),
        }),
        system: `You are creating a sales battle card for competitive selling.

Our Product: ${ourProduct}
Our Strengths: ${ourStrengths.join(', ')}

Create a battle card that helps sales win against this competitor.`,
        prompt: `Create a battle card for competing against: ${competitor}`,
        temperature: 0.6,
      })

      return object as { competitor_name: string; quick_summary: string; their_pitch: string; our_differentiation: { area: string; their_approach: string; our_approach: string; talk_track: string }[]; common_objections: { objection: string; response: string }[]; when_we_win: string[]; when_we_lose: string[]; landmines: string[] }
    },
  },
}

/**
 * Store research findings in the evidence library
 */
export async function storeResearchFindings(
  workspaceId: string,
  findings: {
    title: string
    content: string
    sourceType: string
    sourceUrl?: string
    tags?: string[]
  }[]
): Promise<string[]> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('evidence')
    .insert(
      findings.map(f => ({
        workspace_id: workspaceId,
        title: f.title,
        content: f.content,
        source_type: f.sourceType,
        source_url: f.sourceUrl,
        tags: f.tags || [],
        status: 'active',
      }))
    )
    .select('id')

  if (error) {
    console.error('Failed to store research findings:', error)
    return []
  }

  return data.map(d => d.id)
}

/**
 * Run the research agent for a comprehensive analysis
 */
export async function runResearchAgent(
  options: {
    type: 'competitor' | 'market' | 'audience' | 'comprehensive'
    industry: string
    productDescription: string
    competitors?: string[]
    additionalContext?: string
  }
): Promise<{
  competitorAnalysis?: CompetitorAnalysis
  marketTrends?: MarketTrends
  audienceInsights?: AudienceInsights
  brief: ResearchBrief
}> {
  const results: {
    competitorAnalysis?: CompetitorAnalysis
    marketTrends?: MarketTrends
    audienceInsights?: AudienceInsights
    brief?: ResearchBrief
  } = {}

  // Run competitor analysis
  if (options.type === 'competitor' || options.type === 'comprehensive') {
    if (options.competitors && options.competitors.length > 0) {
      results.competitorAnalysis = await researchAgentTools.analyze_competitors.execute({
        industry: options.industry,
        competitors: options.competitors,
        ourProduct: options.productDescription,
      })
    }
  }

  // Run market trend analysis
  if (options.type === 'market' || options.type === 'comprehensive') {
    results.marketTrends = await researchAgentTools.research_trends.execute({
      industry: options.industry,
      timeframe: '1_year',
    })
  }

  // Run audience research
  if (options.type === 'audience' || options.type === 'comprehensive') {
    results.audienceInsights = await researchAgentTools.research_audience.execute({
      productDescription: options.productDescription,
      industry: options.industry,
    })
  }

  // Compile into a research brief
  const findings: Array<{ source: string; content: string }> = []

  if (results.competitorAnalysis) {
    findings.push({
      source: 'Competitive Analysis',
      content: `Identified ${results.competitorAnalysis.competitors.length} competitors. Key gaps: ${results.competitorAnalysis.market_gaps.slice(0, 3).join(', ')}`,
    })
  }

  if (results.marketTrends) {
    findings.push({
      source: 'Market Trends',
      content: `${results.marketTrends.trends.length} trends identified. Outlook: ${results.marketTrends.industry_outlook}`,
    })
  }

  if (results.audienceInsights) {
    findings.push({
      source: 'Audience Research',
      content: `${results.audienceInsights.segments.length} segments identified. TAM: ${results.audienceInsights.total_addressable_market}`,
    })
  }

  results.brief = await researchAgentTools.generate_research_brief.execute({
    topic: `${options.industry} Market Research`,
    findings,
    businessContext: options.additionalContext || options.productDescription,
  })

  return results as {
    competitorAnalysis?: CompetitorAnalysis
    marketTrends?: MarketTrends
    audienceInsights?: AudienceInsights
    brief: ResearchBrief
  }
}
