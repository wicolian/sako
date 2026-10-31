/**
 * Prompt Enhancer with Learning Loop
 * 
 * Enhances AI prompts with historical performance data
 * to generate better-converting copy over time.
 */

import { getTopPerformingClaims, type ClaimPerformance } from './claim-performance'
import { buildCampaignContext, type PerformanceData } from '@/lib/ai/prompts'

export interface EnhancedPromptContext {
  campaignContext: string
  learningContext: string
  hasLearningData: boolean
}

export interface CampaignInput {
  audience: string
  goal: string
  offer: string
  cta?: string
  messages?: string[]
}

/**
 * Build enhanced campaign context with learning data
 */
export async function buildCampaignContextWithLearning(
  campaign: CampaignInput,
  workspaceId: string,
  category?: string
): Promise<EnhancedPromptContext> {
  // Get base campaign context
  const campaignContext = buildCampaignContext(campaign)

  // Fetch top performing claims from this workspace
  const { claims, hasData } = await getTopPerformingClaims(
    workspaceId,
    5, // Top 5 claims
    50, // Lower threshold for learning (50 impressions)
    category
  )

  if (!hasData || claims.length === 0) {
    return {
      campaignContext,
      learningContext: '',
      hasLearningData: false,
    }
  }

  // Build learning context
  const learningContext = formatLearningContext(claims)

  return {
    campaignContext,
    learningContext,
    hasLearningData: true,
  }
}

/**
 * Format top performing claims into prompt context
 */
function formatLearningContext(claims: ClaimPerformance[]): string {
  if (claims.length === 0) return ''

  const claimsFormatted = claims
    .map((c, i) => {
      const convRate = (c.conversion_rate * 100).toFixed(1)
      const confidence = c.confidence_level === 'high' ? '✓' : c.confidence_level === 'medium' ? '~' : '?'
      return `${i + 1}. "${c.claim_text}" (${convRate}% conversion, ${confidence} confidence)`
    })
    .join('\n')

  return `<learning_from_performance>
IMPORTANT: The following claims have performed well for this workspace in the past.
Use these patterns as inspiration for your generation:

HIGH-PERFORMING CLAIMS:
${claimsFormatted}

HOW TO USE THIS DATA:
- Study the STRUCTURE of these claims (specificity, numbers, outcomes)
- Identify PATTERNS (what makes them convert?)
- Generate VARIATIONS that follow similar patterns
- But don't copy directly - adapt for the current campaign context
- Claims with "✓" have high statistical confidence, prioritize their patterns

ANTI-PATTERNS (avoid claims similar to):
- Vague statements without numbers
- Generic benefits without specifics
- Claims that don't tie to outcomes
</learning_from_performance>`
}

/**
 * Build performance feedback for regeneration cycles
 */
export function buildLearningFeedback(
  previousAngles?: Array<{
    name: string
    trustScore: number
    actualConversionRate?: number
  }>,
  previousHeadlines?: Array<{
    text: string
    conversionRate?: number
  }>
): PerformanceData | undefined {
  if (!previousAngles?.length && !previousHeadlines?.length) {
    return undefined
  }

  return {
    top_performing: previousHeadlines?.map(h => h.text) || [],
  } as PerformanceData
}

/**
 * Combine all prompt enhancements for generation
 */
export function buildEnhancedUserPrompt(
  basePrompt: string,
  enhancedContext: EnhancedPromptContext
): string {
  let prompt = enhancedContext.campaignContext + '\n\n' + basePrompt

  if (enhancedContext.hasLearningData) {
    prompt = enhancedContext.learningContext + '\n\n' + prompt
  }

  return prompt
}

/**
 * Get similar high-performing claims for a given claim
 * Useful for suggesting alternatives
 */
export async function getSimilarHighPerformers(
  workspaceId: string,
  category: string,
  limit: number = 3
): Promise<string[]> {
  const { claims } = await getTopPerformingClaims(workspaceId, limit, 100, category)
  return claims.map(c => c.claim_text)
}

/**
 * Calculate expected performance boost from learning
 * Returns a multiplier (e.g., 1.2 = 20% improvement expected)
 */
export function estimatePerformanceBoost(claims: ClaimPerformance[]): number {
  if (claims.length === 0) return 1.0

  const avgScore = claims.reduce((sum, c) => sum + c.performance_score, 0) / claims.length
  const avgConfidence = claims.filter(c => c.confidence_level === 'high').length / claims.length

  // Base boost from score (50 is neutral)
  const scoreBoost = (avgScore - 50) / 100 // -0.5 to +0.5
  
  // Confidence multiplier
  const confidenceMultiplier = 0.5 + (avgConfidence * 0.5) // 0.5 to 1.0

  return 1.0 + (scoreBoost * confidenceMultiplier)
}
