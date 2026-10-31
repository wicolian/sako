/**
 * Provider Health Monitoring (Phase 4.3)
 * 
 * Monitor external provider health: AI Gateway, HubSpot, Webflow, Supabase.
 */

import { createServiceClient } from '@/lib/supabase/service'

// ============================================================================
// Types
// ============================================================================

export type ProviderStatus = 'healthy' | 'degraded' | 'down' | 'unknown'

export interface Provider {
  id: string
  name: string
  type: 'ai' | 'integration' | 'database' | 'storage'
  icon: string
  description: string
  healthCheckUrl?: string
  statusPageUrl?: string
}

export interface HealthCheck {
  id: string
  providerId: string
  status: ProviderStatus
  latencyMs: number
  errorRate: number // 0-100
  message?: string
  checkedAt: string
}

export interface ProviderHealth {
  provider: Provider
  currentStatus: ProviderStatus
  latencyMs: number
  errorRate: number
  uptime30Days: number // percentage
  lastCheck: string
  recentIncidents: ProviderIncident[]
  history: HealthCheck[]
}

export interface ProviderIncident {
  id: string
  providerId: string
  severity: 'minor' | 'major' | 'critical'
  title: string
  description: string
  status: 'investigating' | 'identified' | 'monitoring' | 'resolved'
  startedAt: string
  resolvedAt?: string
}

// ============================================================================
// Provider Definitions
// ============================================================================

export const PROVIDERS: Provider[] = [
  {
    id: 'openrouter',
    name: 'OpenRouter',
    type: 'ai',
    icon: 'Sparkles',
    description: 'Unified AI routing for all models',
    healthCheckUrl: 'https://openrouter.ai/api/v1/models',
    statusPageUrl: 'https://status.openrouter.ai',
  },
  {
    id: 'supabase',
    name: 'Supabase',
    type: 'database',
    icon: 'Database',
    description: 'Database and authentication',
    healthCheckUrl: 'https://status.supabase.com/api/v2/status.json',
    statusPageUrl: 'https://status.supabase.com',
  },
  {
    id: 'hubspot',
    name: 'HubSpot',
    type: 'integration',
    icon: 'Zap',
    description: 'CRM and marketing integration',
    healthCheckUrl: 'https://api.hubapi.com/status',
    statusPageUrl: 'https://status.hubspot.com',
  },
  {
    id: 'webflow',
    name: 'Webflow',
    type: 'integration',
    icon: 'Globe',
    description: 'Website publishing',
    healthCheckUrl: 'https://api.webflow.com/health',
    statusPageUrl: 'https://status.webflow.com',
  },
  {
    id: 'openai',
    name: 'OpenAI',
    type: 'ai',
    icon: 'Brain',
    description: 'GPT models (via OpenRouter)',
    statusPageUrl: 'https://status.openai.com',
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    type: 'ai',
    icon: 'Bot',
    description: 'Claude models (via OpenRouter)',
    statusPageUrl: 'https://status.anthropic.com',
  },
  {
    id: 'google-ai',
    name: 'Google AI',
    type: 'ai',
    icon: 'Cloud',
    description: 'Gemini models (via OpenRouter)',
    statusPageUrl: 'https://status.cloud.google.com',
  },
]

// ============================================================================
// Status Utilities
// ============================================================================

export const STATUS_CONFIG: Record<ProviderStatus, {
  label: string
  color: string
  bgColor: string
  borderColor: string
}> = {
  healthy: {
    label: 'Healthy',
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
  },
  degraded: {
    label: 'Degraded',
    color: 'text-amber-500',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
  },
  down: {
    label: 'Down',
    color: 'text-destructive',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
  },
  unknown: {
    label: 'Unknown',
    color: 'text-muted-foreground',
    bgColor: 'bg-muted/50',
    borderColor: 'border-border',
  },
}

/**
 * Determine status from check results
 */
export function evaluateStatus(checks: HealthCheck[]): ProviderStatus {
  if (checks.length === 0) return 'unknown'
  
  const recentChecks = checks.slice(0, 10)
  const successRate = recentChecks.filter(c => c.status === 'healthy').length / recentChecks.length
  
  if (successRate >= 0.99) return 'healthy'
  if (successRate >= 0.90) return 'degraded'
  return 'down'
}

/**
 * Calculate uptime percentage over 30 days
 */
export function calculateUptime(checks: HealthCheck[]): number {
  if (checks.length === 0) return 100
  
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  
  const recentChecks = checks.filter(c => new Date(c.checkedAt) >= thirtyDaysAgo)
  if (recentChecks.length === 0) return 100
  
  const healthyCount = recentChecks.filter(c => c.status === 'healthy').length
  return Math.round((healthyCount / recentChecks.length) * 10000) / 100
}

/**
 * Calculate average latency
 */
export function calculateAverageLatency(checks: HealthCheck[]): number {
  if (checks.length === 0) return 0
  
  const recentChecks = checks.slice(0, 100)
  const total = recentChecks.reduce((sum, c) => sum + c.latencyMs, 0)
  return Math.round(total / recentChecks.length)
}

// ============================================================================
// Health Check Operations
// ============================================================================

/**
 * Perform health check for a provider
 */
export async function checkProviderHealth(provider: Provider): Promise<HealthCheck> {
  const startTime = Date.now()
  let status: ProviderStatus = 'unknown'
  let message: string | undefined
  
  try {
    if (provider.healthCheckUrl) {
      const response = await fetch(provider.healthCheckUrl, {
        method: 'GET',
        signal: AbortSignal.timeout(10000), // 10s timeout
      })
      
      if (response.ok) {
        status = 'healthy'
      } else if (response.status >= 500) {
        status = 'down'
        message = `HTTP ${response.status}`
      } else {
        status = 'degraded'
        message = `HTTP ${response.status}`
      }
    } else {
      // No health check URL, assume healthy
      status = 'healthy'
    }
  } catch (error) {
    status = 'down'
    message = error instanceof Error ? error.message : 'Check failed'
  }
  
  const latencyMs = Date.now() - startTime
  
  return {
    id: crypto.randomUUID(),
    providerId: provider.id,
    status,
    latencyMs,
    errorRate: status === 'healthy' ? 0 : status === 'degraded' ? 5 : 100,
    message,
    checkedAt: new Date().toISOString(),
  }
}

/**
 * Store health check result
 */
export async function storeHealthCheck(check: HealthCheck): Promise<void> {
  const supabase = createServiceClient()
  
  await supabase.from('provider_health_checks').insert({
    id: check.id,
    provider_id: check.providerId,
    status: check.status,
    latency_ms: check.latencyMs,
    error_rate: check.errorRate,
    message: check.message,
    checked_at: check.checkedAt,
  })
}

/**
 * Get health checks for a provider
 */
export async function getHealthChecks(
  providerId: string,
  limit: number = 100
): Promise<HealthCheck[]> {
  const supabase = createServiceClient()
  
  const { data, error } = await supabase
    .from('provider_health_checks')
    .select('*')
    .eq('provider_id', providerId)
    .order('checked_at', { ascending: false })
    .limit(limit)
  
  if (error) {
    console.error('Failed to fetch health checks:', error)
    return []
  }
  
  return (data || []).map(row => ({
    id: row.id,
    providerId: row.provider_id,
    status: row.status,
    latencyMs: row.latency_ms,
    errorRate: row.error_rate,
    message: row.message,
    checkedAt: row.checked_at,
  }))
}

/**
 * Get provider health summary
 */
export async function getProviderHealth(providerId: string): Promise<ProviderHealth | null> {
  const provider = PROVIDERS.find(p => p.id === providerId)
  if (!provider) return null
  
  const checks = await getHealthChecks(providerId)
  const currentCheck = checks[0]
  
  return {
    provider,
    currentStatus: evaluateStatus(checks),
    latencyMs: calculateAverageLatency(checks),
    errorRate: currentCheck?.errorRate || 0,
    uptime30Days: calculateUptime(checks),
    lastCheck: currentCheck?.checkedAt || new Date().toISOString(),
    recentIncidents: [], // Would fetch from incidents table
    history: checks.slice(0, 24), // Last 24 checks
  }
}

/**
 * Get all provider health summaries
 */
export async function getAllProviderHealth(): Promise<ProviderHealth[]> {
  const results: ProviderHealth[] = []
  
  for (const provider of PROVIDERS) {
    const health = await getProviderHealth(provider.id)
    if (health) results.push(health)
  }
  
  return results
}

// ============================================================================
// Alert Thresholds
// ============================================================================

export const ALERT_THRESHOLDS = {
  latencyWarning: 1000, // 1s
  latencyCritical: 5000, // 5s
  errorRateWarning: 1, // 1%
  errorRateCritical: 5, // 5%
  uptimeWarning: 99.5, // 99.5%
  uptimeCritical: 99, // 99%
}

/**
 * Check if any thresholds are exceeded
 */
export function checkAlertThresholds(health: ProviderHealth): {
  hasWarning: boolean
  hasCritical: boolean
  alerts: Array<{ type: 'warning' | 'critical'; message: string }>
} {
  const alerts: Array<{ type: 'warning' | 'critical'; message: string }> = []
  
  // Latency checks
  if (health.latencyMs >= ALERT_THRESHOLDS.latencyCritical) {
    alerts.push({ type: 'critical', message: `High latency: ${health.latencyMs}ms` })
  } else if (health.latencyMs >= ALERT_THRESHOLDS.latencyWarning) {
    alerts.push({ type: 'warning', message: `Elevated latency: ${health.latencyMs}ms` })
  }
  
  // Error rate checks
  if (health.errorRate >= ALERT_THRESHOLDS.errorRateCritical) {
    alerts.push({ type: 'critical', message: `High error rate: ${health.errorRate}%` })
  } else if (health.errorRate >= ALERT_THRESHOLDS.errorRateWarning) {
    alerts.push({ type: 'warning', message: `Elevated error rate: ${health.errorRate}%` })
  }
  
  // Uptime checks
  if (health.uptime30Days < ALERT_THRESHOLDS.uptimeCritical) {
    alerts.push({ type: 'critical', message: `Low uptime: ${health.uptime30Days}%` })
  } else if (health.uptime30Days < ALERT_THRESHOLDS.uptimeWarning) {
    alerts.push({ type: 'warning', message: `Reduced uptime: ${health.uptime30Days}%` })
  }
  
  return {
    hasWarning: alerts.some(a => a.type === 'warning'),
    hasCritical: alerts.some(a => a.type === 'critical'),
    alerts,
  }
}
