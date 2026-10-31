import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getWorkspaceId } from '@/lib/workspace'
import { getProvider } from '@/lib/providers/registry'
import type { PerformanceMetrics } from '@/lib/providers/types'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  const { campaignId } = await params
  const supabase = createServiceClient()

  try {
    // Get existing performance data
    const { data: existingPerformance } = await supabase
      .from('performance')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('captured_at', { ascending: false })
      .limit(1)
      .single()

    // Check if we need to fetch fresh data (older than 1 hour)
    const needsFreshData = !existingPerformance || 
      new Date(existingPerformance.captured_at).getTime() < Date.now() - 60 * 60 * 1000

    if (needsFreshData) {
      const { data: deployment } = await supabase
      .from('deployments')
      .select('*')
        .eq('campaign_id', campaignId)
        .eq('status', 'success')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (deployment) {
        try {
          const workspaceId = getWorkspaceId(request)
          const provider = getProvider('hubspot')
          const isConnected = await provider.isConnected(workspaceId)

          if (isConnected && provider.getPerformance) {
            const metrics = await provider.getPerformance(campaignId)
            if (metrics) {
              const newPerformance = await savePerformanceSnapshot(
                supabase,
                campaignId,
                deployment.id,
                metrics
              )

              return NextResponse.json({
                data: formatPerformanceData(newPerformance),
                source: metrics.dataSource === 'hubspot_api' ? 'live' : 'estimated',
              })
            }
          }
        } catch (error) {
          console.error('Failed to fetch provider performance:', error)
        }
      }
    }

    // Return existing data or empty state
    if (existingPerformance) {
      return NextResponse.json({
        data: formatPerformanceData(existingPerformance),
        source: 'cached',
      })
    }

    return NextResponse.json({
      data: null,
      message: 'No performance data available. Deploy your campaign to start tracking.',
    })
  } catch (error) {
    console.error('Failed to fetch performance:', error)
    return NextResponse.json({ error: 'Failed to fetch performance data' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  const { campaignId } = await params
  const supabase = createServiceClient()

  try {
    // Force refresh performance data
    const { data: deployment } = await supabase
      .from('deployments')
      .select('*')
      .eq('campaign_id', campaignId)
      .eq('status', 'success')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (!deployment) {
      return NextResponse.json({
        error: 'No successful deployment found for this campaign',
      }, { status: 404 })
    }

    const workspaceId = getWorkspaceId(request)
    const provider = getProvider('hubspot')
    const isConnected = await provider.isConnected(workspaceId)

    if (!isConnected || !provider.getPerformance) {
      return NextResponse.json({
        error: 'HubSpot not connected',
      }, { status: 400 })
    }

    const metrics = await provider.getPerformance(campaignId)
    if (!metrics) {
      return NextResponse.json({
        error: 'No performance data available for this deployment',
      }, { status: 404 })
    }

    const performance = await savePerformanceSnapshot(
      supabase,
      campaignId,
      deployment.id,
      metrics
    )

    return NextResponse.json({
      data: formatPerformanceData(performance),
      source: metrics.dataSource === 'hubspot_api' ? 'live' : 'estimated',
    })
  } catch (error) {
    console.error('Failed to refresh performance:', error)
    return NextResponse.json({ error: 'Failed to refresh performance data' }, { status: 500 })
  }
}

async function savePerformanceSnapshot(
  supabase: ReturnType<typeof createServiceClient>,
  campaignId: string,
  deploymentId: string,
  metrics: PerformanceMetrics
) {
  const { data, error } = await supabase
    .from('performance')
    .insert({
      campaign_id: campaignId,
      deployment_id: deploymentId,
      captured_at: new Date().toISOString(),
      metrics: {
        pageViews: metrics.pageViews ?? null,
        formSubmissions: metrics.formSubmissions ?? 0,
        contactsCreated: metrics.contactsCreated ?? 0,
        emailsSent: metrics.emailsSent ?? 0,
        emailOpens: metrics.emailOpens ?? 0,
        emailClicks: metrics.emailClicks ?? 0,
        conversionRate: metrics.conversionRate ?? 0,
        dataSource: metrics.dataSource ?? 'estimated',
        lastUpdated: metrics.lastUpdated ?? new Date().toISOString(),
      },
      notes: {
        source: metrics.dataSource ?? 'estimated',
        lastPulled: metrics.lastUpdated ?? new Date().toISOString(),
      },
    })
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return data
}

function formatPerformanceData(performance: {
  id: string
  campaign_id: string
  captured_at: string
  metrics: Record<string, unknown>
  notes?: Record<string, unknown> | null
}) {
  const metrics = performance.metrics
  const dataSource =
    metrics.dataSource === 'hubspot_api' || performance.notes?.source === 'hubspot_api'
      ? 'hubspot_api'
      : 'estimated'
  
  return {
    id: performance.id,
    campaignId: performance.campaign_id,
    capturedAt: performance.captured_at,
    metrics: [
      {
        title: 'Page Views',
        value: metrics.pageViews?.toString() || '0',
        change: null,
      },
      {
        title: 'Form Submissions',
        value: metrics.formSubmissions?.toString() || '0',
        change: null,
      },
      {
        title: 'Contacts Created',
        value: metrics.contactsCreated?.toString() || '0',
        change: null,
      },
      {
        title: 'Conversion Rate',
        value: `${metrics.conversionRate || 0}%`,
        change: null,
      },
    ],
    dataSource,
    lastUpdated: (metrics.lastUpdated as string | undefined) || performance.captured_at,
    notes: performance.notes,
  }
}
