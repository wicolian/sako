'use client'

import { useState, useEffect } from 'react'
import {
  Activity,
  Sparkles,
  Database,
  Globe,
  Zap,
  Brain,
  Bot,
  Cloud,
  RefreshCw,
  ExternalLink,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  TrendingUp,
  TrendingDown,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useToast } from '@/components/ui/use-toast'
import {
  type ProviderHealth,
  type ProviderStatus,
  STATUS_CONFIG,
  ALERT_THRESHOLDS,
  checkAlertThresholds,
} from '@/lib/monitoring/provider-health'

// ============================================================================
// Icon Mapping
// ============================================================================

const ICON_MAP: Record<string, typeof Activity> = {
  Sparkles,
  Database,
  Globe,
  Zap,
  Brain,
  Bot,
  Cloud,
  Activity,
}

// ============================================================================
// Status Badge
// ============================================================================

function StatusBadge({ status }: { status: ProviderStatus }) {
  const config = STATUS_CONFIG[status]
  const Icon = status === 'healthy' ? CheckCircle2 : 
               status === 'degraded' ? AlertTriangle : 
               status === 'down' ? XCircle : Clock

  return (
    <Badge className={cn(config.bgColor, config.color, "border", config.borderColor)}>
      <Icon className="h-3 w-3 mr-1" />
      {config.label}
    </Badge>
  )
}

// ============================================================================
// Provider Card
// ============================================================================

interface ProviderCardProps {
  health: ProviderHealth
  onClick: () => void
}

function ProviderCard({ health, onClick }: ProviderCardProps) {
  const Icon = ICON_MAP[health.provider.icon] || Activity
  const statusConfig = STATUS_CONFIG[health.currentStatus]
  const alerts = checkAlertThresholds(health)

  const latencyTrend = health.history.length >= 2
    ? health.history[0].latencyMs - health.history[1].latencyMs
    : 0

  return (
    <Card 
      className={cn(
        "cursor-pointer transition-all hover:shadow-md",
        alerts.hasCritical && "border-red-300",
        alerts.hasWarning && !alerts.hasCritical && "border-amber-300"
      )}
      onClick={onClick}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-10 h-10 rounded-lg flex items-center justify-center",
              statusConfig.bgColor
            )}>
              <Icon className={cn("h-5 w-5", statusConfig.color)} />
            </div>
            <div>
              <CardTitle className="text-base">{health.provider.name}</CardTitle>
              <CardDescription className="text-xs">
                {health.provider.description}
              </CardDescription>
            </div>
          </div>
          <StatusBadge status={health.currentStatus} />
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Metrics */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Latency</p>
            <div className="flex items-center gap-1">
              <span className={cn(
                "text-lg font-semibold",
                health.latencyMs >= ALERT_THRESHOLDS.latencyCritical && "text-destructive",
                health.latencyMs >= ALERT_THRESHOLDS.latencyWarning && health.latencyMs < ALERT_THRESHOLDS.latencyCritical && "text-amber-500"
              )}>
                {health.latencyMs}ms
              </span>
              {latencyTrend !== 0 && (
                latencyTrend > 0 ? (
                  <TrendingUp className="h-3 w-3 text-red-500" />
                ) : (
                  <TrendingDown className="h-3 w-3 text-emerald-500" />
                )
              )}
            </div>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Error Rate</p>
            <span className={cn(
              "text-lg font-semibold",
              health.errorRate >= ALERT_THRESHOLDS.errorRateCritical && "text-destructive",
              health.errorRate >= ALERT_THRESHOLDS.errorRateWarning && health.errorRate < ALERT_THRESHOLDS.errorRateCritical && "text-amber-500"
            )}>
              {health.errorRate}%
            </span>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">30d Uptime</p>
            <span className={cn(
              "text-lg font-semibold",
              health.uptime30Days < ALERT_THRESHOLDS.uptimeCritical && "text-destructive",
              health.uptime30Days < ALERT_THRESHOLDS.uptimeWarning && health.uptime30Days >= ALERT_THRESHOLDS.uptimeCritical && "text-amber-500"
            )}>
              {health.uptime30Days}%
            </span>
          </div>
        </div>

        {/* Uptime Bar */}
        <div>
          <Progress 
            value={health.uptime30Days} 
            className={cn(
              "h-2",
              health.uptime30Days < 99 && "[&>div]:bg-red-500",
              health.uptime30Days >= 99 && health.uptime30Days < 99.9 && "[&>div]:bg-amber-500"
            )}
          />
        </div>

        {/* Alerts */}
        {alerts.alerts.length > 0 && (
          <div className="space-y-1">
            {alerts.alerts.map((alert, i) => (
              <p key={i} className={cn(
                "text-xs flex items-center gap-1",
                alert.type === 'critical' ? "text-destructive" : "text-amber-500"
              )}>
                <AlertTriangle className="h-3 w-3" />
                {alert.message}
              </p>
            ))}
          </div>
        )}

        {/* Last Check */}
        <p className="text-xs text-muted-foreground">
          Last checked: {new Date(health.lastCheck).toLocaleTimeString()}
        </p>
      </CardContent>
    </Card>
  )
}

// ============================================================================
// Main Dashboard
// ============================================================================

interface ProviderHealthDashboardProps {
  className?: string
}

export function ProviderHealthDashboard({ className }: ProviderHealthDashboardProps) {
  const { toast } = useToast()
  const [providers, setProviders] = useState<ProviderHealth[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [selectedProvider, setSelectedProvider] = useState<ProviderHealth | null>(null)

  const fetchHealth = async () => {
    try {
      const response = await fetch('/api/monitoring/health')
      if (response.ok) {
        const data = await response.json()
        setProviders(data.providers)
      }
    } catch (error) {
      console.error('Failed to fetch provider health:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const refreshHealth = async () => {
    setIsRefreshing(true)
    try {
      await fetch('/api/monitoring/health/refresh', { method: 'POST' })
      await fetchHealth()
      toast({ title: 'Health checks refreshed' })
    } catch (error) {
      toast({
        title: 'Refresh failed',
        variant: 'destructive',
      })
    } finally {
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    fetchHealth()
    // Auto-refresh every 60 seconds
    const interval = setInterval(fetchHealth, 60000)
    return () => clearInterval(interval)
  }, [])

  // Summary stats
  const healthyCount = providers.filter(p => p.currentStatus === 'healthy').length
  const degradedCount = providers.filter(p => p.currentStatus === 'degraded').length
  const downCount = providers.filter(p => p.currentStatus === 'down').length
  const overallStatus: ProviderStatus = 
    downCount > 0 ? 'down' : 
    degradedCount > 0 ? 'degraded' : 
    'healthy'

  if (isLoading) {
    return (
      <div className={cn("flex items-center justify-center py-12", className)}>
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Provider Health
          </h2>
          <p className="text-sm text-muted-foreground">
            Monitor external service status and performance
          </p>
        </div>

        <div className="flex items-center gap-4">
          <StatusBadge status={overallStatus} />
          <Button
            variant="outline"
            size="sm"
            onClick={refreshHealth}
            disabled={isRefreshing}
          >
            <RefreshCw className={cn(
              "h-4 w-4 mr-2",
              isRefreshing && "animate-spin"
            )} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Total Providers</span>
              <span className="text-2xl font-bold">{providers.length}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-emerald-600">Healthy</span>
              <span className="text-2xl font-bold text-emerald-600">{healthyCount}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-amber-500">Degraded</span>
              <span className="text-2xl font-bold text-amber-500">{degradedCount}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-destructive">Down</span>
              <span className="text-2xl font-bold text-destructive">{downCount}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Provider Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {providers.map((provider) => (
          <ProviderCard
            key={provider.provider.id}
            health={provider}
            onClick={() => setSelectedProvider(provider)}
          />
        ))}
      </div>

      {/* Empty State */}
      {providers.length === 0 && (
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center text-center">
              <Activity className="h-12 w-12 text-muted-foreground/30 mb-4" />
              <h3 className="font-medium">No providers configured</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Provider health monitoring will appear here once configured
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
