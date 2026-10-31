/**
 * Provider Health Monitoring (Phase 8.5)
 * 
 * Real-time status checks for all connected providers.
 */

import { createServiceClient } from '@/lib/supabase/service'

export interface ProviderHealth {
  provider: string
  status: 'healthy' | 'degraded' | 'down' | 'unknown'
  latency?: number
  lastCheck: string
  lastError?: string
  uptime?: number
  successRate?: number
}

export interface HealthCheckResult {
  success: boolean
  latency: number
  error?: string
}

// Provider check functions
const providerChecks: Record<string, () => Promise<HealthCheckResult>> = {
  /**
   * Check OpenRouter API health (primary AI provider)
   */
  openrouter: async () => {
    const startTime = Date.now()
    try {
      const response = await fetch('https://openrouter.ai/api/v1/models', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        },
        signal: AbortSignal.timeout(10000),
      })

      return {
        success: response.ok,
        latency: Date.now() - startTime,
        error: response.ok ? undefined : `Status ${response.status}`,
      }
    } catch (error) {
      return {
        success: false,
        latency: Date.now() - startTime,
        error: (error as Error).message,
      }
    }
  },

  /**
   * Check Supabase health
   */
  supabase: async () => {
    const startTime = Date.now()
    try {
      const supabase = createServiceClient()
      const { error } = await supabase.from('workspaces').select('id').limit(1)

      return {
        success: !error,
        latency: Date.now() - startTime,
        error: error?.message,
      }
    } catch (error) {
      return {
        success: false,
        latency: Date.now() - startTime,
        error: (error as Error).message,
      }
    }
  },

  /**
   * Check Webflow API health
   */
  webflow: async () => {
    const startTime = Date.now()
    try {
      const response = await fetch('https://api.webflow.com/v2/token/introspect', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${process.env.WEBFLOW_API_KEY}`,
        },
        signal: AbortSignal.timeout(10000),
      })

      return {
        success: response.ok,
        latency: Date.now() - startTime,
        error: response.ok ? undefined : `Status ${response.status}`,
      }
    } catch (error) {
      return {
        success: false,
        latency: Date.now() - startTime,
        error: (error as Error).message,
      }
    }
  },

  /**
   * Check HubSpot API health
   */
  hubspot: async () => {
    const startTime = Date.now()
    try {
      const response = await fetch('https://api.hubapi.com/account-info/v3/api-usage/daily', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`,
        },
        signal: AbortSignal.timeout(10000),
      })

      return {
        success: response.ok,
        latency: Date.now() - startTime,
        error: response.ok ? undefined : `Status ${response.status}`,
      }
    } catch (error) {
      return {
        success: false,
        latency: Date.now() - startTime,
        error: (error as Error).message,
      }
    }
  },

  /**
   * Check Trigger.dev health
   */
  trigger: async () => {
    const startTime = Date.now()
    try {
      const response = await fetch('https://api.trigger.dev/health', {
        method: 'GET',
        signal: AbortSignal.timeout(10000),
      })

      return {
        success: response.ok,
        latency: Date.now() - startTime,
        error: response.ok ? undefined : `Status ${response.status}`,
      }
    } catch (error) {
      return {
        success: false,
        latency: Date.now() - startTime,
        error: (error as Error).message,
      }
    }
  },
}

/**
 * Check health of a specific provider
 */
export async function checkProviderHealth(provider: string): Promise<ProviderHealth> {
  const checkFn = providerChecks[provider]
  
  if (!checkFn) {
    return {
      provider,
      status: 'unknown',
      lastCheck: new Date().toISOString(),
      lastError: 'Unknown provider',
    }
  }

  try {
    const result = await checkFn()

    return {
      provider,
      status: result.success
        ? result.latency < 1000
          ? 'healthy'
          : 'degraded'
        : 'down',
      latency: result.latency,
      lastCheck: new Date().toISOString(),
      lastError: result.error,
    }
  } catch (error) {
    return {
      provider,
      status: 'down',
      lastCheck: new Date().toISOString(),
      lastError: (error as Error).message,
    }
  }
}

/**
 * Check health of all providers
 */
export async function checkAllProviderHealth(): Promise<ProviderHealth[]> {
  const providers = Object.keys(providerChecks)
  
  const results = await Promise.all(
    providers.map(provider => checkProviderHealth(provider))
  )

  return results
}

/**
 * Get cached provider health status
 */
export async function getCachedProviderHealth(): Promise<ProviderHealth[]> {
  const supabase = createServiceClient()

  const { data } = await supabase
    .from('provider_health')
    .select('*')
    .order('provider')

  if (!data) {
    return []
  }

  return data.map(h => ({
    provider: h.provider,
    status: h.status,
    latency: h.latency,
    lastCheck: h.last_check,
    lastError: h.last_error,
    uptime: h.uptime_24h,
    successRate: h.success_rate_24h,
  }))
}

/**
 * Update provider health in database
 */
export async function updateProviderHealth(health: ProviderHealth): Promise<void> {
  const supabase = createServiceClient()

  await supabase.from('provider_health').upsert({
    provider: health.provider,
    status: health.status,
    latency: health.latency,
    last_check: health.lastCheck,
    last_error: health.lastError,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'provider' })

  // Also record in history for uptime calculations
  await supabase.from('provider_health_history').insert({
    provider: health.provider,
    status: health.status,
    latency: health.latency,
    error: health.lastError,
    checked_at: health.lastCheck,
  })
}

/**
 * Get provider uptime over a period
 */
export async function getProviderUptime(
  provider: string,
  hours: number = 24
): Promise<{
  uptime: number
  avgLatency: number
  checkCount: number
}> {
  const supabase = createServiceClient()

  const since = new Date()
  since.setHours(since.getHours() - hours)

  const { data } = await supabase
    .from('provider_health_history')
    .select('status, latency')
    .eq('provider', provider)
    .gte('checked_at', since.toISOString())

  if (!data || data.length === 0) {
    return { uptime: 100, avgLatency: 0, checkCount: 0 }
  }

  const healthyCount = data.filter(h => h.status === 'healthy' || h.status === 'degraded').length
  const totalLatency = data.reduce((sum, h) => sum + (h.latency || 0), 0)

  return {
    uptime: (healthyCount / data.length) * 100,
    avgLatency: totalLatency / data.length,
    checkCount: data.length,
  }
}

/**
 * Schedule periodic health checks
 */
export function getHealthCheckProviders(): string[] {
  return Object.keys(providerChecks)
}

/**
 * Get overall system health
 */
export async function getSystemHealth(): Promise<{
  status: 'operational' | 'degraded' | 'outage'
  providers: ProviderHealth[]
  critical: string[]
}> {
  const health = await getCachedProviderHealth()
  
  // Critical providers that affect core functionality
  const criticalProviders = ['openrouter', 'supabase']
  
  const criticalDown = health
    .filter(h => criticalProviders.includes(h.provider) && h.status === 'down')
    .map(h => h.provider)

  const anyDown = health.some(h => h.status === 'down')
  const anyDegraded = health.some(h => h.status === 'degraded')

  let status: 'operational' | 'degraded' | 'outage'
  if (criticalDown.length > 0) {
    status = 'outage'
  } else if (anyDown || anyDegraded) {
    status = 'degraded'
  } else {
    status = 'operational'
  }

  return {
    status,
    providers: health,
    critical: criticalDown,
  }
}
