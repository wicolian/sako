import { createServiceClient } from '@/lib/supabase/service'
import { generateStructuredOutput } from '@/lib/ai/ai-sdk-client'
import { z } from 'zod'
import type { Campaign, PageBlock } from '@/lib/supabase/types'

type CampaignRow = Database['public']['Tables']['campaigns']['Row']
type PerformanceRow = Database['public']['Tables']['performance']['Row']

export interface PerformancePrediction {
  predictedConversionRate: number
  confidenceLevel: 'low' | 'medium' | 'high'
  benchmarkComparison: {
    industryAverage: number
    topPerformer: number
    yourPrediction: number
  }
  improvementSuggestions: Array<{
    area: string
    currentState: string
    suggestion: string
    estimatedImpact: number // percentage improvement
  }>
  similarCampaigns: Array<{
    campaignId: string
    campaignName: string
    conversionRate: number
    similarity: number // 0-100
  }>
  riskFactors: Array<{
    factor: string
    severity: 'low' | 'medium' | 'high'
    mitigation: string
  }>
}

const PredictionSchema = z.object({
  predictedConversionRate: z.number(),
  confidenceLevel: z.enum(['low', 'medium', 'high']),
  improvementSuggestions: z.array(z.object({
    area: z.string(),
    currentState: z.string(),
    suggestion: z.string(),
    estimatedImpact: z.number(),
  })),
  riskFactors: z.array(z.object({
    factor: z.string(),
    severity: z.enum(['low', 'medium', 'high']),
    mitigation: z.string(),
  })),
})

export async function predictCampaignPerformance(
  campaign: Campaign,
  pageBlocks: PageBlock[],
  workspaceId: string
): Promise<PerformancePrediction> {
  const supabase = createServiceClient()

  // Get historical performance data
  const { data: historicalCampaigns } = await supabase
    .from('campaigns')
    .select(`
      id,
      name,
      audience,
      goal,
      status,
      performance (
        metrics
      )
    `)
    .eq('workspace_id', workspaceId)
    .eq('status', 'deployed')
    .limit(20)

  // Calculate similar campaigns
  const similarCampaigns = await findSimilarCampaigns(campaign, historicalCampaigns || [])

  // Get top performing claims for this workspace
  const { data: topClaims } = await supabase
    .rpc('get_top_performing_claims', {
      p_workspace_id: workspaceId,
      p_limit: 10,
    })

  // Extract page content for analysis
  const pageContent = extractPageContent(pageBlocks)

  // Use AI to predict performance
  const aiPrediction = await generatePerformancePrediction(
    campaign,
    pageContent,
    topClaims || [],
    similarCampaigns
  )

  // Calculate benchmark comparison
  const avgConversion = similarCampaigns.length > 0
    ? similarCampaigns.reduce((sum, c) => sum + c.conversionRate, 0) / similarCampaigns.length
    : 3.0 // Industry default

  const topConversion = similarCampaigns.length > 0
    ? Math.max(...similarCampaigns.map(c => c.conversionRate))
    : 5.0

  return {
    predictedConversionRate: aiPrediction.predictedConversionRate,
    confidenceLevel: aiPrediction.confidenceLevel,
    benchmarkComparison: {
      industryAverage: avgConversion,
      topPerformer: topConversion,
      yourPrediction: aiPrediction.predictedConversionRate,
    },
    improvementSuggestions: aiPrediction.improvementSuggestions,
    similarCampaigns,
    riskFactors: aiPrediction.riskFactors,
  }
}

async function findSimilarCampaigns(
  campaign: Campaign,
  historicalCampaigns: Array<{
    id: string
    name: string
    audience: string | null
    goal: string | null
    status: string
    performance: Array<{ metrics: Record<string, number> }>
  }>
): Promise<PerformancePrediction['similarCampaigns']> {
  const results: PerformancePrediction['similarCampaigns'] = []

  for (const hist of historicalCampaigns) {
    if (!hist.performance || hist.performance.length === 0) continue

    // Simple text similarity (could use embeddings for better matching)
    const audienceSimilarity = textSimilarity(campaign.audience || '', hist.audience || '')
    const goalSimilarity = textSimilarity(campaign.goal || '', hist.goal || '')
    const overallSimilarity = (audienceSimilarity + goalSimilarity) / 2

    if (overallSimilarity > 0.3) {
      const lastPerformance = hist.performance[0]
      const conversionRate = (lastPerformance.metrics as Record<string, number>)?.conversionRate || 0

      results.push({
        campaignId: hist.id,
        campaignName: hist.name,
        conversionRate,
        similarity: Math.round(overallSimilarity * 100),
      })
    }
  }

  return results.sort((a, b) => b.similarity - a.similarity).slice(0, 5)
}

function textSimilarity(a: string, b: string): number {
  const wordsA = new Set(a.toLowerCase().split(/\s+/))
  const wordsB = new Set(b.toLowerCase().split(/\s+/))
  const intersection = new Set([...wordsA].filter(x => wordsB.has(x)))
  const union = new Set([...wordsA, ...wordsB])
  return union.size > 0 ? intersection.size / union.size : 0
}

function extractPageContent(blocks: PageBlock[]): string {
  const content: string[] = []

  for (const block of blocks) {
    const blockContent = block.props as Record<string, unknown>
    
    // Extract text fields
    const textFields = ['headline', 'subheadline', 'title', 'description', 'body', 'cta_text']
    for (const field of textFields) {
      if (typeof blockContent[field] === 'string') {
        content.push(blockContent[field] as string)
      }
    }

    // Extract from arrays
    if (Array.isArray(blockContent.items)) {
      for (const item of blockContent.items) {
        if (typeof item === 'object' && item !== null) {
          const itemObj = item as Record<string, unknown>
          if (typeof itemObj.title === 'string') content.push(itemObj.title)
          if (typeof itemObj.description === 'string') content.push(itemObj.description)
        }
      }
    }
  }

  return content.join('\n')
}

async function generatePerformancePrediction(
  campaign: Campaign,
  pageContent: string,
  topClaims: Array<{ claim_text: string; conversion_rate: number }>,
  similarCampaigns: PerformancePrediction['similarCampaigns']
): Promise<z.infer<typeof PredictionSchema>> {
  const avgSimilarConversion = similarCampaigns.length > 0
    ? similarCampaigns.reduce((sum, c) => sum + c.conversionRate, 0) / similarCampaigns.length
    : null

  const prompt = `
You are a marketing performance analyst. Predict the conversion rate for this campaign.

Campaign:
- Name: ${campaign.name}
- Audience: ${campaign.audience}
- Goal: ${campaign.goal}
- CTA: ${campaign.cta}

Page Content:
${pageContent.slice(0, 2000)}

Historical Data:
- Similar campaigns converted at: ${avgSimilarConversion ? `${avgSimilarConversion.toFixed(1)}%` : 'No data'}
- Top performing claims: ${topClaims.slice(0, 5).map(c => `"${c.claim_text}" (${c.conversion_rate}%)`).join(', ') || 'No data'}

Predict:
1. Conversion rate (realistic, between 1-10% for B2B landing pages)
2. Confidence level based on available data
3. 3-4 specific improvement suggestions with estimated impact
4. Risk factors that could hurt performance

Be specific and actionable with suggestions.
`

  return generateStructuredOutput({ prompt, schema: PredictionSchema })
}

export async function getPerformanceInsights(
  campaignId: string,
  workspaceId: string
): Promise<{
  currentMetrics: Record<string, number>
  trends: Array<{ metric: string; direction: 'up' | 'down' | 'stable'; percentage: number }>
  recommendations: string[]
}> {
  const supabase = createServiceClient()

  // Get last 7 days of performance
  const { data: recentPerformance } = await supabase
    .from('performance')
    .select('metrics, captured_at')
    .eq('campaign_id', campaignId)
    .eq('workspace_id', workspaceId)
    .order('captured_at', { ascending: false })
    .limit(7)

  if (!recentPerformance || recentPerformance.length === 0) {
    return {
      currentMetrics: {},
      trends: [],
      recommendations: ['Deploy your campaign to start collecting performance data.'],
    }
  }

  const currentMetrics = recentPerformance[0].metrics as Record<string, number>
  const trends: Array<{ metric: string; direction: 'up' | 'down' | 'stable'; percentage: number }> = []

  if (recentPerformance.length >= 2) {
    const previousMetrics = recentPerformance[recentPerformance.length - 1].metrics as Record<string, number>

    for (const [key, currentValue] of Object.entries(currentMetrics)) {
      const previousValue = previousMetrics[key] || 0
      if (previousValue > 0) {
        const change = ((currentValue - previousValue) / previousValue) * 100
        trends.push({
          metric: key,
          direction: change > 5 ? 'up' : change < -5 ? 'down' : 'stable',
          percentage: Math.abs(Math.round(change)),
        })
      }
    }
  }

  const recommendations: string[] = []

  // Generate recommendations based on metrics
  if ((currentMetrics.conversionRate || 0) < 2) {
    recommendations.push('Consider A/B testing your headline for higher engagement.')
  }
  if ((currentMetrics.pageViews || 0) < 100) {
    recommendations.push('Drive more traffic through paid ads or content marketing.')
  }
  if ((currentMetrics.formSubmissions || 0) / (currentMetrics.pageViews || 1) < 0.02) {
    recommendations.push('Optimize your form placement or reduce required fields.')
  }

  return {
    currentMetrics,
    trends,
    recommendations,
  }
}
