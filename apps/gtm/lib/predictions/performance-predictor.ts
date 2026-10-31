/**
 * Performance Prediction (Phase 5.3)
 * 
 * AI-powered performance predictions based on historical data.
 * "Predictive Performance: Learn from outcomes"
 */

import { generateObject } from '@/lib/ai/langsmith-ai'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/service'
import { MODELS } from '@/lib/ai/ai-sdk-client'
import { generateEmbedding } from '@/lib/ai/ai-sdk-client'

export interface PerformancePrediction {
  campaignId: string
  overallScore: number
  confidence: number
  metrics: {
    engagementPrediction: number
    conversionPrediction: number
    clickThroughPrediction: number
    bounceRatePrediction: number
  }
  factors: {
    positive: string[]
    negative: string[]
    neutral: string[]
  }
  recommendations: string[]
  similarCampaigns: Array<{
    id: string
    name: string
    similarity: number
    performance: number
  }>
  createdAt: string
}

const predictionSchema = z.object({
  overall_score: z.number().min(0).max(100).describe('Overall performance prediction 0-100'),
  confidence: z.number().min(0).max(100).describe('Confidence in prediction'),
  engagement_prediction: z.number().min(0).max(100),
  conversion_prediction: z.number().min(0).max(100),
  ctr_prediction: z.number().min(0).max(100),
  bounce_rate_prediction: z.number().min(0).max(100),
  positive_factors: z.array(z.string()).describe('Factors that will help performance'),
  negative_factors: z.array(z.string()).describe('Factors that may hurt performance'),
  neutral_factors: z.array(z.string()).describe('Factors with unclear impact'),
  recommendations: z.array(z.string()).describe('Specific improvements to make'),
})

/**
 * Generate performance prediction for a campaign
 */
export async function predictCampaignPerformance(campaignId: string): Promise<PerformancePrediction> {
  const supabase = createServiceClient()

  // Get campaign details
  const { data: campaign, error } = await supabase
    .from('campaigns')
    .select('*')
    .eq('id', campaignId)
    .maybeSingle()

  if (error || !campaign) {
    throw new Error('Campaign not found')
  }

  // Get historical performance data from similar campaigns
  const similarCampaigns = await findSimilarCampaigns(
    campaign.workspace_id,
    campaign.audience,
    campaign.goal,
    5
  )

  // Build context from historical data
  const historicalContext = similarCampaigns.length > 0
    ? `Historical performance of similar campaigns:\n${similarCampaigns.map(c => 
        `- "${c.name}": ${c.performance_score || 'N/A'} score`
      ).join('\n')}`
    : 'No historical data available for similar campaigns.'

  // Get campaign content for analysis
  const { data: messages } = await supabase
    .from('campaign_messages')
    .select('content, type')
    .eq('campaign_id', campaignId)
    .limit(5)

  const contentSamples = messages?.map(m => m.content).join('\n\n') || ''

  // Generate prediction
  const { object } = await generateObject({
    model: MODELS.REASONING,
    schema: predictionSchema,
    system: `You are a marketing analytics expert predicting campaign performance.

Analyze the campaign and predict its likely performance based on:
1. Target audience clarity and specificity
2. Goal alignment with content
3. Messaging effectiveness
4. Historical patterns from similar campaigns

Be realistic and specific in your analysis.`,
    prompt: `Campaign Details:
Name: ${campaign.name}
Audience: ${campaign.audience || 'Not specified'}
Goal: ${campaign.goal || 'Not specified'}
Offer: ${campaign.offer || 'Not specified'}

${historicalContext}

${contentSamples ? `Content samples:\n${contentSamples}` : ''}

Predict the performance of this campaign.`,
    temperature: 0.4,
  })

  // Save prediction
  const prediction: PerformancePrediction = {
    campaignId,
    overallScore: (object as any).overall_score,
    confidence: (object as any).confidence,
    metrics: {
      engagementPrediction: (object as any).engagement_prediction,
      conversionPrediction: (object as any).conversion_prediction,
      clickThroughPrediction: (object as any).ctr_prediction,
      bounceRatePrediction: (object as any).bounce_rate_prediction,
    },
    factors: {
      positive: (object as any).positive_factors,
      negative: (object as any).negative_factors,
      neutral: (object as any).neutral_factors,
    },
    recommendations: (object as any).recommendations,
    similarCampaigns: similarCampaigns.map(c => ({
      id: c.id,
      name: c.name,
      similarity: c.similarity,
      performance: c.performance_score || 0,
    })),
    createdAt: new Date().toISOString(),
  }

  // Store prediction
  await supabase.from('performance_predictions').insert({
    campaign_id: campaignId,
    workspace_id: campaign.workspace_id,
    overall_score: prediction.overallScore,
    confidence: prediction.confidence,
    metrics: prediction.metrics,
    factors: prediction.factors,
    recommendations: prediction.recommendations,
    similar_campaigns: prediction.similarCampaigns,
  })

  return prediction
}

/**
 * Find similar campaigns for comparison
 */
async function findSimilarCampaigns(
  workspaceId: string,
  audience: string | null,
  goal: string | null,
  limit: number = 5
): Promise<Array<{
  id: string
  name: string
  similarity: number
  performance_score?: number
}>> {
  const supabase = createServiceClient()

  // Get campaigns with performance data
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id, name, audience, goal, performance_score')
    .eq('workspace_id', workspaceId)
    .not('performance_score', 'is', null)
    .order('created_at', { ascending: false })
    .limit(50)

  if (!campaigns || campaigns.length === 0) {
    return []
  }

  // If we have audience/goal, use embedding similarity
  if (audience || goal) {
    const queryText = `${audience || ''} ${goal || ''}`.trim()
    
    try {
      const queryEmbedding = await generateEmbedding(queryText)

      // Simple cosine similarity calculation
      const scored = campaigns.map(c => {
        const campaignText = `${c.audience || ''} ${c.goal || ''}`.trim()
        // Simplified similarity: word overlap
        const queryWords = new Set(queryText.toLowerCase().split(/\s+/))
        const campaignWords = new Set(campaignText.toLowerCase().split(/\s+/))
        const intersection = [...queryWords].filter(w => campaignWords.has(w)).length
        const union = new Set([...queryWords, ...campaignWords]).size
        const similarity = union > 0 ? intersection / union : 0

        return {
          id: c.id,
          name: c.name,
          similarity: similarity * 100,
          performance_score: c.performance_score,
        }
      })

      return scored
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit)
    } catch {
      // Fallback to simple matching
    }
  }

  // Fallback: return recent campaigns with scores
  return campaigns.slice(0, limit).map(c => ({
    id: c.id,
    name: c.name,
    similarity: 50, // Unknown similarity
    performance_score: c.performance_score,
  }))
}

/**
 * Get prediction history for a campaign
 */
export async function getPredictionHistory(campaignId: string): Promise<PerformancePrediction[]> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('performance_predictions')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: false })

  if (error || !data) {
    return []
  }

  return data.map(p => ({
    campaignId: p.campaign_id,
    overallScore: p.overall_score,
    confidence: p.confidence,
    metrics: p.metrics,
    factors: p.factors,
    recommendations: p.recommendations,
    similarCampaigns: p.similar_campaigns,
    createdAt: p.created_at,
  }))
}

/**
 * Update campaign with actual performance
 */
export async function recordActualPerformance(
  campaignId: string,
  metrics: {
    engagementRate?: number
    conversionRate?: number
    clickThroughRate?: number
    bounceRate?: number
    overallScore?: number
  }
): Promise<void> {
  const supabase = createServiceClient()

  await supabase
    .from('campaigns')
    .update({
      performance_score: metrics.overallScore,
      actual_metrics: metrics,
      performance_recorded_at: new Date().toISOString(),
    })
    .eq('id', campaignId)

  // Update predictions with actual results for learning
  await supabase.from('prediction_outcomes').insert({
    campaign_id: campaignId,
    actual_metrics: metrics,
    recorded_at: new Date().toISOString(),
  })
}

/**
 * Get prediction accuracy over time
 */
export async function getPredictionAccuracy(workspaceId: string): Promise<{
  totalPredictions: number
  averageAccuracy: number
  accuracyByMetric: Record<string, number>
}> {
  const supabase = createServiceClient()

  // Get predictions with actual outcomes
  const { data } = await supabase
    .from('performance_predictions')
    .select(`
      overall_score,
      metrics,
      campaigns!inner (
        performance_score,
        actual_metrics
      )
    `)
    .eq('workspace_id', workspaceId)
    .not('campaigns.performance_score', 'is', null)

  if (!data || data.length === 0) {
    return {
      totalPredictions: 0,
      averageAccuracy: 0,
      accuracyByMetric: {},
    }
  }

  // Calculate accuracy
  let totalAccuracy = 0
  const metricAccuracies: Record<string, number[]> = {}

  for (const pred of data) {
    const campaign = pred.campaigns as unknown as { performance_score: number; actual_metrics: Record<string, number> }
    
    if (campaign.performance_score !== undefined) {
      const accuracy = 100 - Math.abs(pred.overall_score - campaign.performance_score)
      totalAccuracy += Math.max(0, accuracy)
    }

    // Track by metric
    if (campaign.actual_metrics) {
      for (const [key, actual] of Object.entries(campaign.actual_metrics)) {
        const predicted = (pred.metrics as Record<string, number>)?.[key]
        if (predicted !== undefined && actual !== undefined) {
          if (!metricAccuracies[key]) {
            metricAccuracies[key] = []
          }
          metricAccuracies[key].push(100 - Math.abs(predicted - actual))
        }
      }
    }
  }

  const accuracyByMetric: Record<string, number> = {}
  for (const [key, values] of Object.entries(metricAccuracies)) {
    accuracyByMetric[key] = values.reduce((a, b) => a + b, 0) / values.length
  }

  return {
    totalPredictions: data.length,
    averageAccuracy: totalAccuracy / data.length,
    accuracyByMetric,
  }
}

/**
 * Generate quick prediction score (lightweight)
 */
export async function quickPredictionScore(
  content: string,
  audience: string,
  goal: string
): Promise<{ score: number; confidence: number }> {
  const { object } = await generateObject({
    model: MODELS.FAST,
    schema: z.object({
      score: z.number().min(0).max(100),
      confidence: z.number().min(0).max(100),
    }),
    system: 'You are a marketing analyst. Quickly assess content quality.',
    prompt: `Rate this marketing content (0-100) for audience "${audience}" with goal "${goal}":\n\n${content.substring(0, 1000)}`,
    temperature: 0.3,
  })

  return object as any
}
