/**
 * Self-Improving RAG Learning System
 * 
 * Tracks generation outcomes, updates template quality scores,
 * and promotes successful generations to the template library.
 */

import { createServiceClient } from '@/lib/supabase/service'
import { generateEmbedding } from '@/lib/ai/ai-sdk-client'

interface GenerationOutcome {
  generationId: string
  outcome: 'accepted' | 'edited' | 'rejected'
  finalHtml?: string
  editDistance?: number
  userFeedback?: string
}

interface GenerationRecord {
  workspaceId: string
  campaignId?: string
  brandId?: string
  userId: string
  requestType: 'landing_page' | 'section' | 'email' | 'ad_copy'
  requestPrompt: string
  sectionType?: string
  retrievedTemplateIds: string[]
  retrievalScores: number[]
  generatedHtml: string
  modelUsed: string
  generationTimeMs: number
  tokensUsed?: number
  costUsd?: number
}

/**
 * Record a new generation for tracking
 */
export async function trackGeneration(record: GenerationRecord): Promise<string> {
  const supabase = createServiceClient()
  
  const { data, error } = await supabase
    .from('generations')
    .insert({
      workspace_id: record.workspaceId,
      campaign_id: record.campaignId,
      brand_id: record.brandId,
      user_id: record.userId,
      request_type: record.requestType,
      request_prompt: record.requestPrompt,
      section_type: record.sectionType,
      retrieved_template_ids: record.retrievedTemplateIds,
      retrieval_scores: record.retrievalScores,
      generated_html: record.generatedHtml,
      status: 'pending',
      model_used: record.modelUsed,
      generation_time_ms: record.generationTimeMs,
      tokens_used: record.tokensUsed,
      cost_usd: record.costUsd,
    })
    .select('id')
    .single()
  
  if (error) {
    console.error('Failed to track generation:', error)
    throw error
  }
  
  return data.id
}

/**
 * Record the outcome of a generation (accept/edit/reject)
 */
export async function recordOutcome(outcome: GenerationOutcome): Promise<void> {
  const supabase = createServiceClient()
  
  // Calculate acceptance score
  let acceptanceScore = 0
  switch (outcome.outcome) {
    case 'accepted':
      acceptanceScore = 1.0
      break
    case 'edited':
      // Score based on edit distance (less editing = higher score)
      if (outcome.editDistance !== undefined) {
        // Assume avg HTML length of 5000, normalize edit distance
        acceptanceScore = Math.max(0.3, 1 - (outcome.editDistance / 5000))
      } else {
        acceptanceScore = 0.6 // Default for edited without distance
      }
      break
    case 'rejected':
      acceptanceScore = 0
      break
  }
  
  // Update generation record
  const { data: generation, error: updateError } = await supabase
    .from('generations')
    .update({
      status: outcome.outcome,
      final_html: outcome.finalHtml,
      edit_distance: outcome.editDistance,
      acceptance_score: acceptanceScore,
      updated_at: new Date().toISOString(),
    })
    .eq('id', outcome.generationId)
    .select('retrieved_template_ids')
    .single()
  
  if (updateError) {
    console.error('Failed to update generation:', updateError)
    throw updateError
  }
  
  // Update quality scores for all retrieved templates
  if (generation?.retrieved_template_ids?.length) {
    for (const templateId of generation.retrieved_template_ids) {
      await supabase.rpc('update_template_quality_score', {
        p_template_id: templateId,
        p_outcome: outcome.outcome,
        p_edit_distance: outcome.editDistance || null,
      })
    }
  }
  
  // If acceptance score is high, create learned section candidate
  if (acceptanceScore >= 0.8 && outcome.finalHtml) {
    await supabase.from('learned_sections').insert({
      generation_id: outcome.generationId,
      acceptance_score: acceptanceScore,
      user_feedback: outcome.userFeedback,
    })
  }
}

/**
 * Calculate Levenshtein edit distance between two strings
 */
export function calculateEditDistance(original: string, edited: string): number {
  if (original.length === 0) return edited.length
  if (edited.length === 0) return original.length
  
  // Simplified for performance - use character-level comparison
  const matrix: number[][] = []
  
  // Limit to first 2000 chars for performance
  const a = original.slice(0, 2000)
  const b = edited.slice(0, 2000)
  
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i]
  }
  
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j
  }
  
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        )
      }
    }
  }
  
  return matrix[b.length][a.length]
}

/**
 * Analyze successful generations and promote to library
 */
export async function analyzeAndPromoteWinners(minScore = 0.85, limit = 50): Promise<number> {
  const supabase = createServiceClient()
  
  // Get high-scoring generations that haven't been promoted
  const { data: winners } = await supabase
    .from('learned_sections')
    .select(`
      id,
      generation_id,
      acceptance_score,
      generations!inner(
        id,
        final_html,
        request_type,
        section_type,
        request_prompt,
        workspace_id
      )
    `)
    .eq('promoted_to_library', false)
    .eq('review_status', 'pending')
    .gte('acceptance_score', minScore)
    .order('acceptance_score', { ascending: false })
    .limit(limit)
  
  if (!winners?.length) return 0
  
  let promoted = 0
  
  for (const winner of winners) {
    try {
      const gen = winner.generations as any
      if (!gen?.final_html) continue
      
      // Check for duplicate HTML
      const htmlHash = await hashHtml(gen.final_html)
      const { data: existing } = await supabase
        .from('design_templates')
        .select('id')
        .eq('section_id', `learned-${winner.generation_id}`)
        .single()
      
      if (existing) continue // Already promoted
      
      // Generate embedding for new template
      const embeddingText = `${gen.section_type || 'page'} ${gen.request_prompt.slice(0, 500)}`
      const embedding = await generateEmbedding(embeddingText)
      
      // Create new template
      const { data: newTemplate, error: insertError } = await supabase
        .from('design_templates')
        .insert({
          section_id: `learned-${winner.generation_id}`,
          template_name: `Learned ${gen.section_type || 'page'} ${Date.now()}`,
          category: gen.section_type || 'generic',
          html: gen.final_html,
          description: gen.request_prompt.slice(0, 500),
          embedding,
          source: 'generated',
          parent_generation_id: gen.id,
          quality_score: winner.acceptance_score,
        })
        .select('id')
        .single()
      
      if (insertError) {
        console.error('Failed to insert learned template:', insertError)
        continue
      }
      
      // Mark as promoted
      await supabase
        .from('learned_sections')
        .update({
          promoted_to_library: true,
          promoted_at: new Date().toISOString(),
          promoted_template_id: newTemplate.id,
          review_status: 'approved',
        })
        .eq('id', winner.id)
      
      promoted++
    } catch (err) {
      console.error('Failed to promote winner:', err)
    }
  }
  
  return promoted
}

/**
 * Hash HTML content for deduplication
 */
async function hashHtml(html: string): Promise<string> {
  // Simple hash using Web Crypto API
  const encoder = new TextEncoder()
  const data = encoder.encode(html)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Get template quality insights
 */
export async function getTemplateInsights(limit = 20): Promise<{
  topPerformers: { id: string; category: string; qualityScore: number; timesUsed: number }[]
  underperformers: { id: string; category: string; qualityScore: number; timesUsed: number }[]
  recentTrends: { category: string; avgScore: number; count: number }[]
}> {
  const supabase = createServiceClient()
  
  // Top performers
  const { data: top } = await supabase
    .from('design_templates')
    .select('id, category, quality_score, times_used')
    .gte('times_used', 5)
    .order('quality_score', { ascending: false })
    .limit(limit)
  
  // Underperformers
  const { data: bottom } = await supabase
    .from('design_templates')
    .select('id, category, quality_score, times_used')
    .gte('times_used', 5)
    .order('quality_score', { ascending: true })
    .limit(limit)
  
  // Recent trends by category (last 7 days)
  const { data: trends } = await supabase
    .from('section_analytics')
    .select('template_id, times_accepted, times_rejected')
    .gte('date', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
  
  // Aggregate trends by category
  const trendsByCategory: Record<string, { total: number; accepted: number }> = {}
  
  // Get category for each template
  if (trends?.length) {
    const templateIds = [...new Set(trends.map(t => t.template_id))]
    const { data: templates } = await supabase
      .from('design_templates')
      .select('id, category')
      .in('id', templateIds)
    
    const categoryMap = new Map(templates?.map(t => [t.id, t.category]) || [])
    
    for (const t of trends) {
      const category = categoryMap.get(t.template_id) || 'unknown'
      if (!trendsByCategory[category]) {
        trendsByCategory[category] = { total: 0, accepted: 0 }
      }
      trendsByCategory[category].total += (t.times_accepted + t.times_rejected)
      trendsByCategory[category].accepted += t.times_accepted
    }
  }
  
  const recentTrends = Object.entries(trendsByCategory).map(([category, data]) => ({
    category,
    avgScore: data.total > 0 ? data.accepted / data.total : 0,
    count: data.total,
  }))
  
  return {
    topPerformers: (top || []).map(t => ({
      id: t.id,
      category: t.category,
      qualityScore: t.quality_score,
      timesUsed: t.times_used,
    })),
    underperformers: (bottom || []).map(t => ({
      id: t.id,
      category: t.category,
      qualityScore: t.quality_score,
      timesUsed: t.times_used,
    })),
    recentTrends: recentTrends.sort((a, b) => b.count - a.count),
  }
}

/**
 * Run daily learning job (call from cron)
 */
export async function runDailyLearningJob(): Promise<{
  promoted: number
  underperformersReviewed: number
}> {
  // Promote winning generations
  const promoted = await analyzeAndPromoteWinners()
  
  // Flag underperformers for review
  const supabase = createServiceClient()
  
  const { data: underperformers } = await supabase
    .from('design_templates')
    .select('id')
    .gte('times_used', 10)
    .lt('quality_score', 0.3)
    .eq('source', 'seed')
  
  return {
    promoted,
    underperformersReviewed: underperformers?.length || 0,
  }
}
