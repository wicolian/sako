import { createServiceClient } from '@/lib/supabase/service'

interface ProductFactRow {
  id: string
  statement: string
  confidence: number
  status: string
  metadata_json: Record<string, unknown> | null
}

interface LearningInsight {
  id: string
  statement: string
  confidence: number
  status: string
  averageConversionRate: number
  citations: number
  confidenceDelta: number
}

export async function extractFactCitations(campaignId: string): Promise<{ cited: number }> {
  const supabase = createServiceClient()

  const [{ data: campaign }, { data: messages }, { data: pageBlocks }] = await Promise.all([
    supabase
      .from('campaigns')
      .select('id, workspace_id')
      .eq('id', campaignId)
      .single(),
    supabase
      .from('messages')
      .select('text')
      .eq('campaign_id', campaignId),
    supabase
      .from('page_blocks')
      .select('props')
      .eq('campaign_id', campaignId),
  ])

  if (!campaign?.workspace_id) {
    return { cited: 0 }
  }

  const { data: facts } = await supabase
    .from('product_facts')
    .select('id, statement, confidence, status, metadata_json')
    .eq('workspace_id', campaign.workspace_id)
    .in('status', ['active', 'review_required', 'draft'])

  const corpus = normalizeText([
    ...(messages || []).map((message) => message.text || ''),
    ...flattenBlockText((pageBlocks || []).map((block) => block.props)),
  ].join(' '))

  if (!corpus || !facts || facts.length === 0) {
    return { cited: 0 }
  }

  const matchedFactIds = facts
    .filter((fact) => matchesFact(corpus, fact.statement))
    .map((fact) => fact.id)

  await supabase
    .from('campaign_fact_citations')
    .delete()
    .eq('campaign_id', campaignId)

  if (matchedFactIds.length === 0) {
    return { cited: 0 }
  }

  const { error } = await supabase
    .from('campaign_fact_citations')
    .upsert(
      matchedFactIds.map((factId) => ({
        workspace_id: campaign.workspace_id,
        campaign_id: campaignId,
        fact_id: factId,
      })),
      { onConflict: 'campaign_id,fact_id' }
    )

  if (error) {
    throw error
  }

  return { cited: matchedFactIds.length }
}

export async function updateFactConfidences(workspaceId: string): Promise<{
  updated: number
  reviewed: number
  workspaceAverage: number
}> {
  const supabase = createServiceClient()

  const [{ data: citations }, { data: performanceRows }, { data: facts }] = await Promise.all([
    supabase
      .from('campaign_fact_citations')
      .select('campaign_id, fact_id')
      .eq('workspace_id', workspaceId),
    supabase
      .from('performance')
      .select('campaign_id, metrics, captured_at, campaigns!inner(workspace_id)')
      .eq('campaigns.workspace_id', workspaceId)
      .order('captured_at', { ascending: false }),
    supabase
      .from('product_facts')
      .select('id, statement, confidence, status, metadata_json')
      .eq('workspace_id', workspaceId),
  ])

  if (!citations || citations.length === 0 || !performanceRows || performanceRows.length === 0 || !facts) {
    await recordLearningRun(workspaceId, {
      updated: 0,
      reviewed: 0,
      workspaceAverage: 0,
    })
    return { updated: 0, reviewed: 0, workspaceAverage: 0 }
  }

  const latestPerformanceByCampaign = new Map<string, number>()
  for (const row of performanceRows) {
    if (!latestPerformanceByCampaign.has(row.campaign_id)) {
      const metrics = row.metrics as Record<string, unknown>
      latestPerformanceByCampaign.set(row.campaign_id, Number(metrics.conversionRate || 0))
    }
  }

  const performanceValues = [...latestPerformanceByCampaign.values()].filter((value) => Number.isFinite(value))
  const workspaceAverage =
    performanceValues.length > 0
      ? Number((performanceValues.reduce((sum, value) => sum + value, 0) / performanceValues.length).toFixed(2))
      : 0

  const citationMap = new Map<string, number[]>()
  for (const citation of citations) {
    const conversionRate = latestPerformanceByCampaign.get(citation.campaign_id)
    if (conversionRate === undefined) {
      continue
    }

    const current = citationMap.get(citation.fact_id) || []
    citationMap.set(citation.fact_id, [...current, conversionRate])
  }

  let updated = 0
  let reviewed = 0

  for (const fact of facts as ProductFactRow[]) {
    const rates = citationMap.get(fact.id)
    if (!rates || rates.length === 0) {
      continue
    }

    const averageConversionRate = Number((rates.reduce((sum, value) => sum + value, 0) / rates.length).toFixed(2))
    const metadata = { ...(fact.metadata_json || {}) }
    let confidence = fact.confidence
    let status = fact.status
    let confidenceDelta = 0

    if (workspaceAverage > 0 && averageConversionRate > workspaceAverage) {
      confidence = Math.min(1, Number((fact.confidence + 0.05).toFixed(3)))
      confidenceDelta = Number((confidence - fact.confidence).toFixed(3))
      metadata.learning_performance = 'winner'
      updated++
    } else if (workspaceAverage > 0 && averageConversionRate < workspaceAverage * 0.5) {
      status = 'review_required'
      metadata.learning_review = true
      reviewed++
    } else {
      metadata.learning_performance = 'neutral'
    }

    metadata.learning_avg_conversion = averageConversionRate
    metadata.learning_citations = rates.length
    metadata.learning_confidence_delta = confidenceDelta
    metadata.learning_updated_at = new Date().toISOString()

    await supabase
      .from('product_facts')
      .update({
        confidence,
        status,
        metadata_json: metadata,
      })
      .eq('id', fact.id)
  }

  await recordLearningRun(workspaceId, {
    updated,
    reviewed,
    workspaceAverage,
  })

  return { updated, reviewed, workspaceAverage }
}

export async function getLearningInsights(workspaceId: string): Promise<{
  topClaims: LearningInsight[]
  claimsToReview: LearningInsight[]
}> {
  const supabase = createServiceClient()

  const { data: facts } = await supabase
    .from('product_facts')
    .select('id, statement, confidence, status, metadata_json')
    .eq('workspace_id', workspaceId)
    .order('confidence', { ascending: false })
    .limit(100)

  const insights = (facts || []).map((fact) => {
    const metadata = (fact.metadata_json || {}) as Record<string, unknown>
    return {
      id: fact.id,
      statement: fact.statement,
      confidence: fact.confidence,
      status: fact.status,
      averageConversionRate: Number(metadata.learning_avg_conversion || 0),
      citations: Number(metadata.learning_citations || 0),
      confidenceDelta: Number(metadata.learning_confidence_delta || 0),
    }
  })

  return {
    topClaims: insights
      .filter((fact) => fact.averageConversionRate > 0)
      .sort((left, right) => right.averageConversionRate - left.averageConversionRate || right.confidence - left.confidence)
      .slice(0, 5),
    claimsToReview: insights
      .filter((fact) => fact.status === 'review_required')
      .sort((left, right) => right.citations - left.citations)
      .slice(0, 5),
  }
}

async function recordLearningRun(
  workspaceId: string,
  summary: Record<string, unknown>
): Promise<void> {
  const supabase = createServiceClient()
  await supabase.from('brain_learning_runs').insert({
    workspace_id: workspaceId,
    status: 'completed',
    summary_json: summary,
  })
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function matchesFact(corpus: string, statement: string): boolean {
  const normalizedStatement = normalizeText(statement)
  if (!normalizedStatement) {
    return false
  }

  if (corpus.includes(normalizedStatement)) {
    return true
  }

  const tokens = normalizedStatement.split(' ').filter((token) => token.length > 3)
  if (tokens.length < 4) {
    return false
  }

  const matchedTokens = tokens.filter((token) => corpus.includes(token))
  return matchedTokens.length / tokens.length >= 0.6
}

function flattenBlockText(blockProps: unknown[]): string[] {
  const values: string[] = []

  const visit = (input: unknown) => {
    if (typeof input === 'string') {
      values.push(input)
      return
    }

    if (Array.isArray(input)) {
      input.forEach(visit)
      return
    }

    if (input && typeof input === 'object') {
      Object.values(input).forEach(visit)
    }
  }

  blockProps.forEach(visit)
  return values
}
