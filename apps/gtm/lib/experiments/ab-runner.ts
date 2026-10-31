/**
 * A/B Test Runner (Phase 5.2)
 * 
 * Framework for running experiments and analyzing results.
 */

import { createServiceClient } from '@/lib/supabase/service'

export interface Experiment {
  id: string
  workspace_id: string
  campaign_id: string
  name: string
  description?: string
  hypothesis: string
  status: 'draft' | 'running' | 'paused' | 'completed' | 'cancelled'
  variants: ExperimentVariant[]
  traffic_split: Record<string, number> // variant_id -> percentage
  metrics: ExperimentMetric[]
  target_sample_size: number
  current_sample_size: number
  confidence_level: number // e.g., 95
  start_date?: string
  end_date?: string
  winner_variant_id?: string
  created_at: string
  updated_at: string
}

export interface ExperimentVariant {
  id: string
  name: string
  description?: string
  is_control: boolean
  content: Record<string, unknown>
  impressions: number
  conversions: number
  conversion_rate: number
}

export interface ExperimentMetric {
  name: string
  type: 'conversion' | 'engagement' | 'revenue' | 'custom'
  goal: 'maximize' | 'minimize'
  primary: boolean
}

export interface ExperimentResult {
  experiment_id: string
  variant_id: string
  metric_name: string
  value: number
  confidence_interval: { lower: number; upper: number }
  statistical_significance: boolean
  p_value: number
  improvement_vs_control: number
}

/**
 * Create a new experiment
 */
export async function createExperiment(
  workspaceId: string,
  campaignId: string,
  params: {
    name: string
    description?: string
    hypothesis: string
    variants: Array<{ name: string; is_control: boolean; content: Record<string, unknown> }>
    metrics: ExperimentMetric[]
    targetSampleSize?: number
    confidenceLevel?: number
  }
): Promise<Experiment | null> {
  const supabase = createServiceClient()

  // Generate variant IDs and initialize stats
  const variants: ExperimentVariant[] = params.variants.map(v => ({
    id: `var_${crypto.randomUUID().substring(0, 8)}`,
    name: v.name,
    description: undefined,
    is_control: v.is_control,
    content: v.content,
    impressions: 0,
    conversions: 0,
    conversion_rate: 0,
  }))

  // Equal traffic split by default
  const trafficSplit: Record<string, number> = {}
  const splitPercentage = 100 / variants.length
  for (const variant of variants) {
    trafficSplit[variant.id] = splitPercentage
  }

  const { data, error } = await supabase
    .from('experiments')
    .insert({
      workspace_id: workspaceId,
      campaign_id: campaignId,
      name: params.name,
      description: params.description,
      hypothesis: params.hypothesis,
      status: 'draft',
      variants,
      traffic_split: trafficSplit,
      metrics: params.metrics,
      target_sample_size: params.targetSampleSize || 1000,
      current_sample_size: 0,
      confidence_level: params.confidenceLevel || 95,
    })
    .select()
    .single()

  if (error) {
    console.error('Failed to create experiment:', error)
    return null
  }

  return data as Experiment
}

/**
 * Start an experiment
 */
export async function startExperiment(experimentId: string): Promise<boolean> {
  const supabase = createServiceClient()

  const { error } = await supabase
    .from('experiments')
    .update({
      status: 'running',
      start_date: new Date().toISOString(),
    })
    .eq('id', experimentId)
    .eq('status', 'draft')

  return !error
}

/**
 * Pause an experiment
 */
export async function pauseExperiment(experimentId: string): Promise<boolean> {
  const supabase = createServiceClient()

  const { error } = await supabase
    .from('experiments')
    .update({ status: 'paused' })
    .eq('id', experimentId)
    .eq('status', 'running')

  return !error
}

/**
 * Resume an experiment
 */
export async function resumeExperiment(experimentId: string): Promise<boolean> {
  const supabase = createServiceClient()

  const { error } = await supabase
    .from('experiments')
    .update({ status: 'running' })
    .eq('id', experimentId)
    .eq('status', 'paused')

  return !error
}

/**
 * Record an impression for a variant
 */
export async function recordImpression(
  experimentId: string,
  variantId: string,
  visitorId: string
): Promise<void> {
  const supabase = createServiceClient()

  // Get experiment
  const { data: experiment } = await supabase
    .from('experiments')
    .select('variants, current_sample_size')
    .eq('id', experimentId)
    .single()

  if (!experiment) return

  // Update variant impressions
  const variants = experiment.variants as ExperimentVariant[]
  const updatedVariants = variants.map(v => {
    if (v.id === variantId) {
      const newImpressions = v.impressions + 1
      return {
        ...v,
        impressions: newImpressions,
        conversion_rate: v.conversions / newImpressions,
      }
    }
    return v
  })

  await supabase
    .from('experiments')
    .update({
      variants: updatedVariants,
      current_sample_size: experiment.current_sample_size + 1,
    })
    .eq('id', experimentId)

  // Record event
  await supabase.from('experiment_events').insert({
    experiment_id: experimentId,
    variant_id: variantId,
    visitor_id: visitorId,
    event_type: 'impression',
  })
}

/**
 * Record a conversion for a variant
 */
export async function recordConversion(
  experimentId: string,
  variantId: string,
  visitorId: string,
  metricName: string,
  value: number = 1
): Promise<void> {
  const supabase = createServiceClient()

  // Get experiment
  const { data: experiment } = await supabase
    .from('experiments')
    .select('variants')
    .eq('id', experimentId)
    .single()

  if (!experiment) return

  // Update variant conversions
  const variants = experiment.variants as ExperimentVariant[]
  const updatedVariants = variants.map(v => {
    if (v.id === variantId) {
      const newConversions = v.conversions + 1
      return {
        ...v,
        conversions: newConversions,
        conversion_rate: v.impressions > 0 ? newConversions / v.impressions : 0,
      }
    }
    return v
  })

  await supabase
    .from('experiments')
    .update({ variants: updatedVariants })
    .eq('id', experimentId)

  // Record event
  await supabase.from('experiment_events').insert({
    experiment_id: experimentId,
    variant_id: variantId,
    visitor_id: visitorId,
    event_type: 'conversion',
    metric_name: metricName,
    value,
  })
}

/**
 * Get variant for a visitor (consistent assignment)
 */
export async function getVariantForVisitor(
  experimentId: string,
  visitorId: string
): Promise<ExperimentVariant | null> {
  const supabase = createServiceClient()

  // Check for existing assignment
  const { data: existingEvent } = await supabase
    .from('experiment_events')
    .select('variant_id')
    .eq('experiment_id', experimentId)
    .eq('visitor_id', visitorId)
    .limit(1)
    .single()

  // Get experiment
  const { data: experiment } = await supabase
    .from('experiments')
    .select('variants, traffic_split, status')
    .eq('id', experimentId)
    .single()

  if (!experiment || experiment.status !== 'running') {
    return null
  }

  const variants = experiment.variants as ExperimentVariant[]

  if (existingEvent) {
    // Return previously assigned variant
    return variants.find(v => v.id === existingEvent.variant_id) || null
  }

  // Assign new variant based on traffic split
  const trafficSplit = experiment.traffic_split as Record<string, number>
  const random = hashVisitorId(visitorId) % 100

  let cumulative = 0
  for (const variant of variants) {
    cumulative += trafficSplit[variant.id] || 0
    if (random < cumulative) {
      return variant
    }
  }

  // Fallback to first variant
  return variants[0]
}

/**
 * Deterministic hash for visitor ID
 */
function hashVisitorId(visitorId: string): number {
  let hash = 0
  for (let i = 0; i < visitorId.length; i++) {
    const char = visitorId.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return Math.abs(hash)
}

/**
 * Calculate statistical significance
 */
export function calculateSignificance(
  controlConversions: number,
  controlImpressions: number,
  variantConversions: number,
  variantImpressions: number
): { significant: boolean; pValue: number; improvement: number } {
  const controlRate = controlImpressions > 0 ? controlConversions / controlImpressions : 0
  const variantRate = variantImpressions > 0 ? variantConversions / variantImpressions : 0

  // Simple two-proportion z-test
  const pooledRate = (controlConversions + variantConversions) / (controlImpressions + variantImpressions)
  const standardError = Math.sqrt(
    pooledRate * (1 - pooledRate) * (1 / controlImpressions + 1 / variantImpressions)
  )

  if (standardError === 0) {
    return { significant: false, pValue: 1, improvement: 0 }
  }

  const zScore = (variantRate - controlRate) / standardError
  const pValue = 2 * (1 - normalCDF(Math.abs(zScore)))

  const improvement = controlRate > 0 ? ((variantRate - controlRate) / controlRate) * 100 : 0

  return {
    significant: pValue < 0.05,
    pValue,
    improvement,
  }
}

/**
 * Normal CDF approximation
 */
function normalCDF(x: number): number {
  const a1 = 0.254829592
  const a2 = -0.284496736
  const a3 = 1.421413741
  const a4 = -1.453152027
  const a5 = 1.061405429
  const p = 0.3275911

  const sign = x < 0 ? -1 : 1
  x = Math.abs(x) / Math.sqrt(2)

  const t = 1.0 / (1.0 + p * x)
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x)

  return 0.5 * (1.0 + sign * y)
}

/**
 * Get experiment results
 */
export async function getExperimentResults(experimentId: string): Promise<ExperimentResult[]> {
  const supabase = createServiceClient()

  const { data: experiment } = await supabase
    .from('experiments')
    .select('variants, metrics')
    .eq('id', experimentId)
    .single()

  if (!experiment) return []

  const variants = experiment.variants as ExperimentVariant[]
  const metrics = experiment.metrics as ExperimentMetric[]

  // Find control
  const control = variants.find(v => v.is_control)
  if (!control) return []

  const results: ExperimentResult[] = []

  for (const metric of metrics) {
    for (const variant of variants) {
      if (variant.is_control) continue

      const { significant, pValue, improvement } = calculateSignificance(
        control.conversions,
        control.impressions,
        variant.conversions,
        variant.impressions
      )

      const conversionRate = variant.impressions > 0
        ? variant.conversions / variant.impressions
        : 0

      results.push({
        experiment_id: experimentId,
        variant_id: variant.id,
        metric_name: metric.name,
        value: conversionRate * 100,
        confidence_interval: {
          lower: Math.max(0, conversionRate - 0.02) * 100,
          upper: Math.min(1, conversionRate + 0.02) * 100,
        },
        statistical_significance: significant,
        p_value: pValue,
        improvement_vs_control: improvement,
      })
    }
  }

  return results
}

/**
 * Complete an experiment and determine winner
 */
export async function completeExperiment(experimentId: string): Promise<string | null> {
  const supabase = createServiceClient()

  const results = await getExperimentResults(experimentId)
  
  // Find best performing variant with statistical significance
  const significantResults = results.filter(r => r.statistical_significance)
  let winnerId: string | null = null

  if (significantResults.length > 0) {
    const best = significantResults.reduce((prev, current) =>
      current.improvement_vs_control > prev.improvement_vs_control ? current : prev
    )
    if (best.improvement_vs_control > 0) {
      winnerId = best.variant_id
    }
  }

  await supabase
    .from('experiments')
    .update({
      status: 'completed',
      end_date: new Date().toISOString(),
      winner_variant_id: winnerId,
    })
    .eq('id', experimentId)

  return winnerId
}
