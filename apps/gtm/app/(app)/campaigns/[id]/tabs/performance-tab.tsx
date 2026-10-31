'use client'

import { useState, useEffect } from 'react'
import { BarChart3, TrendingUp, Users, MousePointerClick, RefreshCw, Loader2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { Campaign } from '@/lib/supabase/types'

interface PerformanceTabProps {
  campaign: Campaign
}

interface MetricItem {
  title: string
  value: string
  change: string | null
}

interface PerformanceResponse {
  id: string
  campaignId: string
  capturedAt: string
  metrics: MetricItem[]
  dataSource: 'hubspot_api' | 'estimated'
  lastUpdated?: string
  notes?: Record<string, unknown>
}

import { EmptyState } from '@/components/ui/empty-state'

export function PerformanceTab({ campaign }: PerformanceTabProps) {
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [performanceData, setPerformanceData] = useState<PerformanceResponse | null>(null)
  const [source, setSource] = useState<string>('')

  useEffect(() => {
    loadPerformance()
  }, [campaign.id])

  const loadPerformance = async () => {
    try {
      const res = await fetch(`/api/performance/${campaign.id}`)
      if (res.ok) {
        const response = await res.json()
        setPerformanceData(response.data || null)
        setSource(response.source || '')
      }
    } catch (error) {
      console.error('Failed to load performance:', error)
    } finally {
      setLoading(false)
    }
  }

  const refreshPerformance = async () => {
    setRefreshing(true)
    try {
      const res = await fetch(`/api/performance/${campaign.id}`, { method: 'POST' })
      if (res.ok) {
        const response = await res.json()
        setPerformanceData(response.data || null)
        setSource(response.source || '')
      }
    } catch (error) {
      console.error('Failed to refresh performance:', error)
    } finally {
      setRefreshing(false)
    }
  }

  const isPublished = campaign.status === 'published' || campaign.status === 'running'
  const isLiveData = performanceData?.dataSource === 'hubspot_api'

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!isPublished && !performanceData) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <EmptyState
          icon={BarChart3}
          title="No performance data yet"
          description="Publish your campaign to start tracking performance metrics directly from HubSpot."
        />
      </div>
    )
  }

  // Get metrics from formatted API response
  const getMetricValue = (title: string) => {
    const metric = performanceData?.metrics?.find(m => m.title === title)
    return metric?.value || '0'
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold">Performance</h2>
            <Badge variant={isLiveData ? 'default' : 'secondary'}>
              {isLiveData ? 'Live' : 'Estimated'}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Track how your campaign is performing in HubSpot.
            {source && <span className="ml-2 text-xs">({source})</span>}
          </p>
        </div>
        <Button variant="outline" onClick={refreshPerformance} disabled={refreshing}>
          {refreshing ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4 mr-2" />
          )}
          Refresh Data
        </Button>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <MetricCard
          title="Page Views"
          value={getMetricValue('Page Views')}
          change={null}
          icon={BarChart3}
        />
        <MetricCard
          title="Form Submissions"
          value={getMetricValue('Form Submissions')}
          change={null}
          icon={MousePointerClick}
          highlight
        />
        <MetricCard
          title="Conversion Rate"
          value={getMetricValue('Conversion Rate')}
          change={null}
          icon={TrendingUp}
        />
        <MetricCard
          title="Contacts Created"
          value={getMetricValue('Contacts Created')}
          change={null}
          icon={Users}
        />
      </div>

      {/* Last Updated */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Performance Summary</CardTitle>
          <CardDescription>
            {performanceData?.lastUpdated
              ? `Last updated: ${new Date(performanceData.lastUpdated).toLocaleString()}`
              : 'Click "Refresh Data" to pull metrics from HubSpot'
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!performanceData ? (
            <div className="h-32 flex items-center justify-center text-muted-foreground text-sm">
              No data yet. Click "Refresh Data" to pull metrics from HubSpot.
            </div>
          ) : (
            <div className="space-y-3">
              {performanceData.metrics.map((metric, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                >
                  <span className="text-sm text-muted-foreground">
                    {metric.title}
                  </span>
                  <span className="text-sm font-medium">
                    {metric.value}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function MetricCard({
  title,
  value,
  change,
  icon: Icon,
  highlight,
}: {
  title: string
  value: string
  change: string | null
  icon: React.ElementType
  highlight?: boolean
}) {
  return (
    <Card className={highlight ? 'border-primary' : ''}>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-muted-foreground">{title}</span>
          <Icon className={`w-4 h-4 ${highlight ? 'text-primary' : 'text-muted-foreground'}`} />
        </div>
        <div className={`text-2xl font-semibold ${highlight ? 'text-primary' : ''}`}>
          {value}
        </div>
        {change && (
          <div className="text-xs text-emerald-500 dark:text-green-500 mt-1">
            {change} vs last period
          </div>
        )}
      </CardContent>
    </Card>
  )
}
