'use client'

import { useEffect, useState } from 'react'
import { Activity, BarChart3, DollarSign, ExternalLink, Loader2, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface TraceStats {
  summary: {
    totalCalls: number
    totalCost: number
    avgLatencyMs: number
    successRate: number
  }
  byModel: Array<{
    model: string
    calls: number
    cost: number
    avgLatency: number
    errorRate: number
  }>
  byDay: Array<{
    date: string
    calls: number
    cost: number
  }>
  recentErrors: Array<{
    timestamp: string
    model: string
    operation: string
    error: string
  }>
  config: {
    externalTracingEnabled: boolean
    langsmithProject: string | null
    langsmithDashboardUrl: string | null
  }
  dateRange: {
    start: string
    end: string
    days: number
  }
}

export function ObservabilityDashboard() {
  const [stats, setStats] = useState<TraceStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState('30')

  useEffect(() => {
    loadStats()
  }, [days])

  const loadStats = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/traces?days=${days}`)
      if (res.ok) {
        const data = await res.json()
        setStats(data)
      }
    } catch (error) {
      console.error('Failed to load trace stats:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-48">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  if (!stats) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-48">
          <p className="text-muted-foreground">Failed to load observability data</p>
        </CardContent>
      </Card>
    )
  }

  const formatCost = (cost: number) => {
    return cost < 0.01 ? `$${cost.toFixed(4)}` : `$${cost.toFixed(2)}`
  }

  const formatLatency = (ms: number) => {
    return ms > 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`
  }

  return (
    <div className="space-y-6">
      {/* External Tracing Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-500/10 rounded-lg flex items-center justify-center">
              <Activity className="w-5 h-5 text-emerald-500" />
            </div>
            AI Observability
          </CardTitle>
          <CardDescription>
            Monitor AI usage, costs, and performance across your workspace
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* LangSmith Status */}
          <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
            <div className="flex items-center gap-3">
              {stats.config.externalTracingEnabled ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-amber-500" />
              )}
              <div>
                <p className="font-medium">
                  {stats.config.externalTracingEnabled ? 'LangSmith Connected' : 'LangSmith Not Configured'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {stats.config.externalTracingEnabled 
                    ? `Project: ${stats.config.langsmithProject}`
                    : 'Set LANGSMITH_API_KEY to enable external tracing'}
                </p>
              </div>
            </div>
            {stats.config.externalTracingEnabled && stats.config.langsmithDashboardUrl && (
              <Button variant="outline" size="sm" asChild>
                <a href={stats.config.langsmithDashboardUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Open Dashboard
                </a>
              </Button>
            )}
          </div>

          {/* Time Range Selector */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Showing data for:</span>
            <Select value={days} onValueChange={setDays}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <BarChart3 className="w-4 h-4" />
              <span className="text-sm">Total Calls</span>
            </div>
            <p className="text-2xl font-bold">{stats.summary.totalCalls.toLocaleString()}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <DollarSign className="w-4 h-4" />
              <span className="text-sm">Total Cost</span>
            </div>
            <p className="text-2xl font-bold">{formatCost(stats.summary.totalCost)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Activity className="w-4 h-4" />
              <span className="text-sm">Avg Latency</span>
            </div>
            <p className="text-2xl font-bold">{formatLatency(stats.summary.avgLatencyMs)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <CheckCircle2 className="w-4 h-4" />
              <span className="text-sm">Success Rate</span>
            </div>
            <p className="text-2xl font-bold">{(stats.summary.successRate * 100).toFixed(1)}%</p>
          </CardContent>
        </Card>
      </div>

      {/* Usage by Model */}
      {stats.byModel.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Usage by Model</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats.byModel.map((model) => {
                const maxCalls = Math.max(...stats.byModel.map(m => m.calls))
                const percentage = (model.calls / maxCalls) * 100
                
                return (
                  <div key={model.model} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium truncate max-w-[200px]">{model.model}</span>
                      <div className="flex items-center gap-4 text-muted-foreground">
                        <span>{model.calls.toLocaleString()} calls</span>
                        <span>{formatCost(model.cost)}</span>
                        <span>{formatLatency(model.avgLatency)}</span>
                        {model.errorRate > 0 && (
                          <Badge variant="destructive" className="text-xs">
                            {(model.errorRate * 100).toFixed(1)}% errors
                          </Badge>
                        )}
                      </div>
                    </div>
                    <Progress value={percentage} className="h-2" />
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Errors */}
      {stats.recentErrors.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <XCircle className="w-4 h-4 text-destructive" />
              Recent Errors
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.recentErrors.slice(0, 5).map((error, index) => (
                <div key={index} className="flex items-start gap-3 p-3 bg-destructive/5 rounded-lg">
                  <XCircle className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium">{error.model}</span>
                      <span className="text-muted-foreground">•</span>
                      <span className="text-muted-foreground">{error.operation}</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1 truncate">{error.error}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(error.timestamp).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {stats.summary.totalCalls === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Activity className="w-12 h-12 text-muted-foreground/50 mb-4" />
            <h3 className="font-medium mb-1">No AI calls recorded yet</h3>
            <p className="text-sm text-muted-foreground">
              Start generating content to see usage statistics
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
