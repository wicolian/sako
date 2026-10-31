/**
 * A/B Testing Service
 * 
 * Manages experiments, variant assignment, event tracking,
 * and statistical analysis for campaign optimization.
 */

import { createServiceClient } from '@/lib/supabase/service'
import * as crypto from 'crypto'

export type ExperimentStatus = 'draft' | 'running' | 'paused' | 'completed' | 'archived'
export type PrimaryMetric = 'conversion_rate' | 'click_through_rate' | 'bounce_rate' | 'time_on_page'
export type ContentType = 'headline' | 'cta' | 'hero' | 'full_page' | 'copy'

export interface Experiment {
  id: string
  workspaceId: string
  campaignId: string
  name: string
  description?: string
  hypothesis?: string
  status: ExperimentStatus
  trafficPercentage: number
  primaryMetric: PrimaryMetric
  secondaryMetrics: string[]
  confidenceLevel: number
  minimumSampleSize: number
  startedAt?: Date
  endedAt?: Date
  winnerVariantId?: string
  finalConfidence?: number
  createdAt: Date
  createdBy: string
}

export interface ExperimentVariant {
  id: string
  experimentId: string
  name: string
  isControl: boolean
  trafficWeight: number
  contentType: ContentType
  contentChanges: Record<string, any>
  html?: string
}

export interface ExperimentMetrics {
  variantId: string
  visitors: number
  conversions: number
  conversionRate: number
  bounceRate: number
  avgTimeOnPage: number
  totalValue: number
}

export interface StatisticalResult {
  controlVariantId: string
  testVariantId: string
  metricName: string
  controlValue: number
  testValue: number
  relativeUplift: number
  absoluteDifference: number
  pValue: number
  confidenceLevel: number
  isSignificant: boolean
  sampleSizes: { control: number; test: number }
}

class ABTestingService {
  private _supabase: ReturnType<typeof createServiceClient> | null = null
  
  private get supabase() {
    if (!this._supabase) {
      this._supabase = createServiceClient()
    }
    return this._supabase
  }

  /**
   * Create a new experiment
   */
  async createExperiment(data: {
    workspaceId: string
    campaignId: string
    name: string
    description?: string
    hypothesis?: string
    primaryMetric: PrimaryMetric
    secondaryMetrics?: string[]
    trafficPercentage?: number
    confidenceLevel?: number
    minimumSampleSize?: number
    createdBy: string
  }): Promise<Experiment> {
    const { data: experiment, error } = await this.supabase
      .from('experiments')
      .insert({
        workspace_id: data.workspaceId,
        campaign_id: data.campaignId,
        name: data.name,
        description: data.description,
        hypothesis: data.hypothesis,
        primary_metric: data.primaryMetric,
        secondary_metrics: data.secondaryMetrics || [],
        traffic_percentage: data.trafficPercentage || 100,
        confidence_level: data.confidenceLevel || 0.95,
        minimum_sample_size: data.minimumSampleSize || 100,
        status: 'draft',
        created_by: data.createdBy,
      })
      .select()
      .single()

    if (error) throw error

    return this.mapExperiment(experiment)
  }

  /**
   * Add a variant to an experiment
   */
  async addVariant(data: {
    experimentId: string
    name: string
    isControl?: boolean
    trafficWeight?: number
    contentType: ContentType
    contentChanges: Record<string, any>
    html?: string
  }): Promise<ExperimentVariant> {
    // If this is control, ensure no other control exists
    if (data.isControl) {
      await this.supabase
        .from('experiment_variants')
        .update({ is_control: false })
        .eq('experiment_id', data.experimentId)
    }

    const { data: variant, error } = await this.supabase
      .from('experiment_variants')
      .insert({
        experiment_id: data.experimentId,
        name: data.name,
        is_control: data.isControl || false,
        traffic_weight: data.trafficWeight || 50,
        content_type: data.contentType,
        content_changes: data.contentChanges,
        html: data.html,
      })
      .select()
      .single()

    if (error) throw error

    return this.mapVariant(variant)
  }

  /**
   * Start an experiment
   */
  async startExperiment(experimentId: string): Promise<void> {
    // Validate experiment has variants
    const { count } = await this.supabase
      .from('experiment_variants')
      .select('id', { count: 'exact' })
      .eq('experiment_id', experimentId)

    if (!count || count < 2) {
      throw new Error('Experiment must have at least 2 variants')
    }

    await this.supabase
      .from('experiments')
      .update({
        status: 'running',
        started_at: new Date().toISOString(),
      })
      .eq('id', experimentId)
  }

  /**
   * Pause an experiment
   */
  async pauseExperiment(experimentId: string): Promise<void> {
    await this.supabase
      .from('experiments')
      .update({ status: 'paused' })
      .eq('id', experimentId)
  }

  /**
   * End an experiment and declare winner
   */
  async endExperiment(experimentId: string, winnerVariantId?: string): Promise<void> {
    const updateData: any = {
      status: 'completed',
      ended_at: new Date().toISOString(),
    }

    if (winnerVariantId) {
      // Calculate final confidence
      const results = await this.calculateResults(experimentId)
      const winnerResult = results.find(
        (r) =>
          r.testVariantId === winnerVariantId || r.controlVariantId === winnerVariantId
      )

      updateData.winner_variant_id = winnerVariantId
      updateData.final_confidence = winnerResult?.confidenceLevel
    }

    await this.supabase
      .from('experiments')
      .update(updateData)
      .eq('id', experimentId)
  }

  /**
   * Assign a visitor to a variant
   */
  async assignVariant(
    experimentId: string,
    visitorId: string,
    userId?: string
  ): Promise<string | null> {
    // Use database function for deterministic assignment
    const { data, error } = await this.supabase.rpc('assign_experiment_variant', {
      p_experiment_id: experimentId,
      p_visitor_id: visitorId,
      p_user_id: userId || null,
    })

    if (error) {
      console.error('Failed to assign variant:', error)
      return null
    }

    return data
  }

  /**
   * Get variant for a visitor (check existing assignment first)
   */
  async getVariantForVisitor(
    experimentId: string,
    visitorId: string
  ): Promise<ExperimentVariant | null> {
    // Check existing assignment
    const { data: assignment } = await this.supabase
      .from('experiment_assignments')
      .select('variant_id')
      .eq('experiment_id', experimentId)
      .eq('visitor_id', visitorId)
      .single()

    let variantId = assignment?.variant_id

    // If no assignment, create one
    if (!variantId) {
      variantId = await this.assignVariant(experimentId, visitorId)
    }

    if (!variantId) return null

    // Get variant details
    const { data: variant } = await this.supabase
      .from('experiment_variants')
      .select('*')
      .eq('id', variantId)
      .single()

    return variant ? this.mapVariant(variant) : null
  }

  /**
   * Track an event
   */
  async trackEvent(data: {
    experimentId: string
    variantId: string
    assignmentId?: string
    eventType: 'page_view' | 'click' | 'conversion' | 'bounce' | 'scroll_depth'
    eventName?: string
    isConversion?: boolean
    conversionValue?: number
    timeOnPageMs?: number
    scrollDepthPercent?: number
    elementId?: string
    elementType?: string
    metadata?: Record<string, any>
  }): Promise<void> {
    await this.supabase.from('experiment_events').insert({
      experiment_id: data.experimentId,
      variant_id: data.variantId,
      assignment_id: data.assignmentId,
      event_type: data.eventType,
      event_name: data.eventName,
      is_conversion: data.isConversion || false,
      conversion_value: data.conversionValue,
      time_on_page_ms: data.timeOnPageMs,
      scroll_depth_percent: data.scrollDepthPercent,
      element_id: data.elementId,
      element_type: data.elementType,
      metadata: data.metadata || {},
    })
  }

  /**
   * Get experiment metrics
   */
  async getMetrics(experimentId: string): Promise<ExperimentMetrics[]> {
    const { data: variants } = await this.supabase
      .from('experiment_variants')
      .select('id, name')
      .eq('experiment_id', experimentId)

    if (!variants?.length) return []

    const metrics: ExperimentMetrics[] = []

    for (const variant of variants) {
      // Get aggregated metrics
      const { data: dailyMetrics } = await this.supabase
        .from('experiment_metrics')
        .select('*')
        .eq('experiment_id', experimentId)
        .eq('variant_id', variant.id)

      const aggregated = (dailyMetrics || []).reduce(
        (acc, day) => ({
          visitors: acc.visitors + day.visitors,
          conversions: acc.conversions + day.conversions,
          bounces: acc.bounces + day.bounces,
          totalTimeOnPage: acc.totalTimeOnPage + day.total_time_on_page_ms,
          totalValue: acc.totalValue + day.conversion_value,
          pageViews: acc.pageViews + day.page_views,
        }),
        { visitors: 0, conversions: 0, bounces: 0, totalTimeOnPage: 0, totalValue: 0, pageViews: 0 }
      )

      metrics.push({
        variantId: variant.id,
        visitors: aggregated.visitors,
        conversions: aggregated.conversions,
        conversionRate: aggregated.visitors > 0
          ? (aggregated.conversions / aggregated.visitors) * 100
          : 0,
        bounceRate: aggregated.pageViews > 0
          ? (aggregated.bounces / aggregated.pageViews) * 100
          : 0,
        avgTimeOnPage: aggregated.visitors > 0
          ? aggregated.totalTimeOnPage / aggregated.visitors / 1000 // Convert to seconds
          : 0,
        totalValue: aggregated.totalValue,
      })
    }

    return metrics
  }

  /**
   * Calculate statistical significance
   */
  async calculateResults(experimentId: string): Promise<StatisticalResult[]> {
    const { data: experiment } = await this.supabase
      .from('experiments')
      .select('primary_metric, confidence_level')
      .eq('id', experimentId)
      .single()

    if (!experiment) return []

    const metrics = await this.getMetrics(experimentId)
    if (metrics.length < 2) return []

    // Find control variant
    const { data: variants } = await this.supabase
      .from('experiment_variants')
      .select('id, is_control')
      .eq('experiment_id', experimentId)

    const controlVariant = variants?.find((v) => v.is_control)
    if (!controlVariant) return []

    const controlMetrics = metrics.find((m) => m.variantId === controlVariant.id)
    if (!controlMetrics) return []

    const results: StatisticalResult[] = []

    for (const variant of variants || []) {
      if (variant.is_control) continue

      const testMetrics = metrics.find((m) => m.variantId === variant.id)
      if (!testMetrics) continue

      // Calculate based on primary metric
      let controlValue: number
      let testValue: number

      switch (experiment.primary_metric) {
        case 'conversion_rate':
          controlValue = controlMetrics.conversionRate
          testValue = testMetrics.conversionRate
          break
        case 'bounce_rate':
          controlValue = controlMetrics.bounceRate
          testValue = testMetrics.bounceRate
          break
        case 'time_on_page':
          controlValue = controlMetrics.avgTimeOnPage
          testValue = testMetrics.avgTimeOnPage
          break
        default:
          controlValue = controlMetrics.conversionRate
          testValue = testMetrics.conversionRate
      }

      // Calculate p-value using z-test for proportions
      const { pValue, zScore } = this.calculateZTest(
        controlMetrics.conversions,
        controlMetrics.visitors,
        testMetrics.conversions,
        testMetrics.visitors
      )

      const relativeUplift = controlValue > 0
        ? ((testValue - controlValue) / controlValue) * 100
        : 0

      const isSignificant = pValue < (1 - experiment.confidence_level)

      results.push({
        controlVariantId: controlVariant.id,
        testVariantId: variant.id,
        metricName: experiment.primary_metric,
        controlValue,
        testValue,
        relativeUplift,
        absoluteDifference: testValue - controlValue,
        pValue,
        confidenceLevel: 1 - pValue,
        isSignificant,
        sampleSizes: {
          control: controlMetrics.visitors,
          test: testMetrics.visitors,
        },
      })

      // Store results
      await this.supabase.from('experiment_results').insert({
        experiment_id: experimentId,
        control_variant_id: controlVariant.id,
        test_variant_id: variant.id,
        metric_name: experiment.primary_metric,
        control_value: controlValue,
        test_value: testValue,
        relative_uplift: relativeUplift,
        absolute_difference: testValue - controlValue,
        p_value: pValue,
        confidence_level: 1 - pValue,
        is_significant: isSignificant,
        control_sample_size: controlMetrics.visitors,
        test_sample_size: testMetrics.visitors,
      })
    }

    return results
  }

  /**
   * Calculate z-test for two proportions
   */
  private calculateZTest(
    successA: number,
    totalA: number,
    successB: number,
    totalB: number
  ): { pValue: number; zScore: number } {
    if (totalA === 0 || totalB === 0) {
      return { pValue: 1, zScore: 0 }
    }

    const pA = successA / totalA
    const pB = successB / totalB
    const pPooled = (successA + successB) / (totalA + totalB)

    const se = Math.sqrt(pPooled * (1 - pPooled) * (1 / totalA + 1 / totalB))
    if (se === 0) {
      return { pValue: 1, zScore: 0 }
    }

    const zScore = (pB - pA) / se

    // Two-tailed p-value using normal distribution approximation
    const pValue = 2 * (1 - this.normalCdf(Math.abs(zScore)))

    return { pValue, zScore }
  }

  /**
   * Standard normal cumulative distribution function
   */
  private normalCdf(x: number): number {
    const a1 = 0.254829592
    const a2 = -0.284496736
    const a3 = 1.421413741
    const a4 = -1.453152027
    const a5 = 1.061405429
    const p = 0.3275911

    const sign = x < 0 ? -1 : 1
    x = Math.abs(x) / Math.sqrt(2)

    const t = 1.0 / (1.0 + p * x)
    const y = 1.0 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x)

    return 0.5 * (1.0 + sign * y)
  }

  /**
   * Get experiment by ID
   */
  async getExperiment(experimentId: string): Promise<Experiment | null> {
    const { data } = await this.supabase
      .from('experiments')
      .select('*')
      .eq('id', experimentId)
      .single()

    return data ? this.mapExperiment(data) : null
  }

  /**
   * Get experiments for a campaign
   */
  async getExperimentsForCampaign(campaignId: string): Promise<Experiment[]> {
    const { data } = await this.supabase
      .from('experiments')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('created_at', { ascending: false })

    return (data || []).map(this.mapExperiment)
  }

  /**
   * Get variants for an experiment
   */
  async getVariants(experimentId: string): Promise<ExperimentVariant[]> {
    const { data } = await this.supabase
      .from('experiment_variants')
      .select('*')
      .eq('experiment_id', experimentId)
      .order('created_at', { ascending: true })

    return (data || []).map(this.mapVariant)
  }

  // Mapping functions
  private mapExperiment(data: any): Experiment {
    return {
      id: data.id,
      workspaceId: data.workspace_id,
      campaignId: data.campaign_id,
      name: data.name,
      description: data.description,
      hypothesis: data.hypothesis,
      status: data.status,
      trafficPercentage: data.traffic_percentage,
      primaryMetric: data.primary_metric,
      secondaryMetrics: data.secondary_metrics || [],
      confidenceLevel: data.confidence_level,
      minimumSampleSize: data.minimum_sample_size,
      startedAt: data.started_at ? new Date(data.started_at) : undefined,
      endedAt: data.ended_at ? new Date(data.ended_at) : undefined,
      winnerVariantId: data.winner_variant_id,
      finalConfidence: data.final_confidence,
      createdAt: new Date(data.created_at),
      createdBy: data.created_by,
    }
  }

  private mapVariant(data: any): ExperimentVariant {
    return {
      id: data.id,
      experimentId: data.experiment_id,
      name: data.name,
      isControl: data.is_control,
      trafficWeight: data.traffic_weight,
      contentType: data.content_type,
      contentChanges: data.content_changes || {},
      html: data.html,
    }
  }
}

// Singleton
export const abTesting = new ABTestingService()

/**
 * Generate a consistent visitor ID from request
 */
export function generateVisitorId(request: Request): string {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const userAgent = request.headers.get('user-agent') || 'unknown'
  
  // Create a hash of IP + User Agent for consistent visitor identification
  const hash = crypto.createHash('sha256')
  hash.update(`${ip}-${userAgent}`)
  return hash.digest('hex').substring(0, 32)
}
