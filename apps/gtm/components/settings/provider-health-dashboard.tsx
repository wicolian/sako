'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Activity, CheckCircle, XCircle, AlertTriangle, RefreshCw, Clock, TrendingUp, Server, Zap, Database, Cloud, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'

interface ProviderHealth {
  provider: string
  status: 'healthy' | 'degraded' | 'down' | 'unknown'
  latency_ms: number | null
  last_check: string
  uptime_24h?: number
  error_message?: string
}

interface SystemHealth {
  overall: 'healthy' | 'degraded' | 'down'
  providers: ProviderHealth[]
  checked_at: string
}

const providerIcons: Record<string, React.ReactNode> = {
  openai: <Zap className="w-5 h-5" />,
  anthropic: <Server className="w-5 h-5" />,
  ai_gateway: <Cloud className="w-5 h-5" />,
  supabase: <Database className="w-5 h-5" />,
  webflow: <Activity className="w-5 h-5" />,
  hubspot: <Send className="w-5 h-5" />,
  trigger: <RefreshCw className="w-5 h-5" />,
}

const providerLabels: Record<string, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  ai_gateway: 'Vercel AI Gateway',
  supabase: 'Supabase',
  webflow: 'Webflow',
  hubspot: 'HubSpot',
  trigger: 'Trigger.dev',
}

const statusColors: Record<string, { bg: string; text: string; border: string }> = {
  healthy: { bg: 'bg-emerald-50 dark:bg-emerald-950/30', text: 'text-emerald-700 dark:text-emerald-400', border: 'border-emerald-200 dark:border-emerald-800' },
  degraded: { bg: 'bg-amber-50 ', text: 'text-amber-500 ', border: 'border-amber-200 dark:border-amber-800' },
  down: { bg: 'bg-rose-50 dark:bg-rose-950/30', text: 'text-rose-700 dark:text-rose-400', border: 'border-rose-200 dark:border-rose-800' },
  unknown: { bg: 'bg-card', text: 'text-muted-foreground', border: 'border-border' },
}

export function ProviderHealthDashboard() {
  const [health, setHealth] = useState<SystemHealth | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [expandedProvider, setExpandedProvider] = useState<string | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(true)

  const fetchHealth = useCallback(async () => {
    try {
      const response = await fetch('/api/health')
      if (response.ok) {
        const data = await response.json()
        setHealth(data)
      }
    } catch (error) {
      console.error('Failed to fetch health:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchHealth()
    
    // Auto-refresh every 30 seconds if enabled
    let interval: NodeJS.Timeout
    if (autoRefresh) {
      interval = setInterval(fetchHealth, 30000)
    }
    
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [fetchHealth, autoRefresh])

  const handleRefresh = () => {
    setRefreshing(true)
    fetchHealth()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
        >
          <Activity className="w-8 h-8 text-amber-400" />
        </motion.div>
      </div>
    )
  }

  if (!health) {
    return (
      <div className="text-center py-12">
        <XCircle className="w-12 h-12 text-rose-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium mb-2">Unable to fetch health status</h3>
        <Button onClick={handleRefresh}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Try Again
        </Button>
      </div>
    )
  }

  const healthyCount = health.providers.filter(p => p.status === 'healthy').length
  const totalCount = health.providers.length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Provider Health</h2>
          <p className="text-sm text-muted-foreground">
            Monitor the status of connected services
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded border-border"
            />
            Auto-refresh
          </label>
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={cn("w-4 h-4 mr-2", refreshing && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Overall status */}
      <div className={cn(
        "p-6 rounded-xl border",
        statusColors[health.overall].bg,
        statusColors[health.overall].border
      )}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={cn(
              "w-12 h-12 rounded-full flex items-center justify-center",
              health.overall === 'healthy' && "bg-emerald-100 dark:bg-emerald-500/20",
              health.overall === 'degraded' && "bg-amber-500/10 dark:bg-amber-500/20",
              health.overall === 'down' && "bg-rose-100 dark:bg-rose-500/20"
            )}>
              {health.overall === 'healthy' && <CheckCircle className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />}
              {health.overall === 'degraded' && <AlertTriangle className="w-6 h-6 text-amber-500 " />}
              {health.overall === 'down' && <XCircle className="w-6 h-6 text-rose-600 dark:text-rose-400" />}
            </div>
            <div>
              <h3 className="text-lg font-semibold capitalize">{health.overall}</h3>
              <p className="text-sm text-muted-foreground">
                {healthyCount} of {totalCount} services operational
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground mb-1">Last checked</p>
            <p className="text-sm font-medium">
              {new Date(health.checked_at).toLocaleTimeString()}
            </p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-4">
          <Progress 
            value={(healthyCount / totalCount) * 100} 
            className="h-2 bg-muted"
          />
        </div>
      </div>

      {/* Provider cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {health.providers.map((provider) => (
          <motion.div
            key={provider.provider}
            layout
            className={cn(
              "rounded-lg border overflow-hidden cursor-pointer",
              statusColors[provider.status].bg,
              statusColors[provider.status].border
            )}
            onClick={() => setExpandedProvider(
              expandedProvider === provider.provider ? null : provider.provider
            )}
          >
            <div className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center",
                    provider.status === 'healthy' && "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400",
                    provider.status === 'degraded' && "bg-amber-500/10 dark:bg-amber-500/20 text-amber-500 ",
                    provider.status === 'down' && "bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400",
                    provider.status === 'unknown' && "bg-muted text-muted-foreground"
                  )}>
                    {providerIcons[provider.provider] || <Server className="w-5 h-5" />}
                  </div>
                  <div>
                    <h4 className="font-medium">
                      {providerLabels[provider.provider] || provider.provider}
                    </h4>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-xs capitalize",
                          statusColors[provider.status].text,
                          statusColors[provider.status].border
                        )}
                      >
                        {provider.status}
                      </Badge>
                      {provider.latency_ms !== null && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {provider.latency_ms}ms
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Status indicator */}
                <div className="relative">
                  <div className={cn(
                    "w-3 h-3 rounded-full",
                    provider.status === 'healthy' && "bg-emerald-500",
                    provider.status === 'degraded' && "bg-amber-500",
                    provider.status === 'down' && "bg-rose-500",
                    provider.status === 'unknown' && "bg-muted-foreground"
                  )} />
                  {provider.status === 'healthy' && (
                    <motion.div
                      className="absolute inset-0 rounded-full bg-emerald-500"
                      animate={{ scale: [1, 1.8, 1], opacity: [1, 0, 1] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    />
                  )}
                </div>
              </div>

              {/* Expanded details */}
              <AnimatePresence>
                {expandedProvider === provider.provider && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="pt-4 mt-4 border-t border-border space-y-3">
                      {/* Uptime */}
                      {provider.uptime_24h !== undefined && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground flex items-center gap-2">
                            <TrendingUp className="w-4 h-4" />
                            24h Uptime
                          </span>
                          <span className={cn(
                            "font-medium",
                            provider.uptime_24h >= 99 && "text-emerald-600 dark:text-emerald-400",
                            provider.uptime_24h >= 95 && provider.uptime_24h < 99 && "text-amber-500 ",
                            provider.uptime_24h < 95 && "text-rose-600 dark:text-rose-400"
                          )}>
                            {provider.uptime_24h.toFixed(2)}%
                          </span>
                        </div>
                      )}

                      {/* Last check */}
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground flex items-center gap-2">
                          <Clock className="w-4 h-4" />
                          Last Check
                        </span>
                        <span className="text-muted-foreground">
                          {new Date(provider.last_check).toLocaleTimeString()}
                        </span>
                      </div>

                      {/* Error message if present */}
                      {provider.error_message && (
                        <div className="p-2 rounded bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800">
                          <p className="text-xs text-rose-700 dark:text-rose-300 font-mono">
                            {provider.error_message}
                          </p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400" />
          <span>Healthy</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-amber-400" />
          <span>Degraded</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-rose-400" />
          <span>Down</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-zinc-500" />
          <span>Unknown</span>
        </div>
      </div>
    </div>
  )
}
