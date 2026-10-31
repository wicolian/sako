/**
 * Provider Health Dashboard Unit Tests
 */

import { describe, it, expect } from 'vitest'

describe('Provider Health', () => {
  describe('Health Status Types', () => {
    type HealthStatus = 'healthy' | 'degraded' | 'down' | 'unknown'

    interface ProviderHealth {
      id: string
      name: string
      status: HealthStatus
      lastChecked: string
      latencyMs?: number
      errorRate?: number
      uptime?: number // Percentage over last 30 days
    }

    const getStatusColor = (status: HealthStatus): string => {
      switch (status) {
        case 'healthy': return '#22c55e'
        case 'degraded': return '#eab308'
        case 'down': return '#ef4444'
        default: return '#6b7280'
      }
    }

    const getStatusLabel = (status: HealthStatus): string => {
      switch (status) {
        case 'healthy': return 'Operational'
        case 'degraded': return 'Degraded'
        case 'down': return 'Outage'
        default: return 'Unknown'
      }
    }

    it('returns green for healthy', () => {
      expect(getStatusColor('healthy')).toBe('#22c55e')
    })

    it('returns yellow for degraded', () => {
      expect(getStatusColor('degraded')).toBe('#eab308')
    })

    it('returns red for down', () => {
      expect(getStatusColor('down')).toBe('#ef4444')
    })

    it('returns correct labels', () => {
      expect(getStatusLabel('healthy')).toBe('Operational')
      expect(getStatusLabel('degraded')).toBe('Degraded')
      expect(getStatusLabel('down')).toBe('Outage')
    })
  })

  describe('Health Check Evaluation', () => {
    interface HealthCheckResult {
      success: boolean
      latencyMs: number
      error?: string
    }

    const evaluateHealth = (checks: HealthCheckResult[]): {
      status: 'healthy' | 'degraded' | 'down'
      avgLatency: number
      successRate: number
    } => {
      if (checks.length === 0) {
        return { status: 'down', avgLatency: 0, successRate: 0 }
      }

      const successCount = checks.filter(c => c.success).length
      const successRate = successCount / checks.length
      const avgLatency = checks.reduce((sum, c) => sum + c.latencyMs, 0) / checks.length

      let status: 'healthy' | 'degraded' | 'down'
      if (successRate >= 0.99) {
        status = 'healthy'
      } else if (successRate >= 0.90) {
        status = 'degraded'
      } else {
        status = 'down'
      }

      return { status, avgLatency: Math.round(avgLatency), successRate }
    }

    it('returns healthy for 100% success', () => {
      const checks = [
        { success: true, latencyMs: 100 },
        { success: true, latencyMs: 150 },
        { success: true, latencyMs: 120 },
      ]
      const result = evaluateHealth(checks)
      expect(result.status).toBe('healthy')
      expect(result.successRate).toBe(1)
    })

    it('returns degraded for 95% success', () => {
      const checks = Array(100).fill(null).map((_, i) => ({
        success: i < 95,
        latencyMs: 100,
      }))
      const result = evaluateHealth(checks)
      expect(result.status).toBe('degraded')
    })

    it('returns down for less than 90% success', () => {
      const checks = Array(10).fill(null).map((_, i) => ({
        success: i < 8, // 80%
        latencyMs: 100,
      }))
      const result = evaluateHealth(checks)
      expect(result.status).toBe('down')
    })

    it('calculates average latency', () => {
      const checks = [
        { success: true, latencyMs: 100 },
        { success: true, latencyMs: 200 },
        { success: true, latencyMs: 300 },
      ]
      const result = evaluateHealth(checks)
      expect(result.avgLatency).toBe(200)
    })
  })

  describe('Provider Configuration', () => {
    interface Provider {
      id: string
      name: string
      healthEndpoint: string
      checkInterval: number // Minutes
    }

    const PROVIDERS: Provider[] = [
      { id: 'hubspot', name: 'HubSpot', healthEndpoint: '/api/hubspot/status', checkInterval: 5 },
      { id: 'webflow', name: 'Webflow', healthEndpoint: '/api/webflow/status', checkInterval: 5 },
      { id: 'supabase', name: 'Supabase', healthEndpoint: '/api/health/supabase', checkInterval: 1 },
      { id: 'ai-gateway', name: 'AI Gateway', healthEndpoint: '/api/health/ai', checkInterval: 1 },
    ]

    it('has required providers configured', () => {
      expect(PROVIDERS.find(p => p.id === 'hubspot')).toBeDefined()
      expect(PROVIDERS.find(p => p.id === 'webflow')).toBeDefined()
      expect(PROVIDERS.find(p => p.id === 'supabase')).toBeDefined()
      expect(PROVIDERS.find(p => p.id === 'ai-gateway')).toBeDefined()
    })

    it('all providers have health endpoints', () => {
      for (const provider of PROVIDERS) {
        expect(provider.healthEndpoint).toMatch(/^\/api\//)
      }
    })

    it('critical providers check more frequently', () => {
      const supabase = PROVIDERS.find(p => p.id === 'supabase')
      const hubspot = PROVIDERS.find(p => p.id === 'hubspot')
      expect(supabase?.checkInterval).toBeLessThan(hubspot?.checkInterval ?? 0)
    })
  })

  describe('Uptime Calculation', () => {
    interface HealthRecord {
      timestamp: Date
      status: 'up' | 'down'
    }

    const calculateUptime = (records: HealthRecord[], days: number): number => {
      if (records.length < 2) return 100

      const cutoff = new Date()
      cutoff.setDate(cutoff.getDate() - days)

      const relevantRecords = records.filter(r => r.timestamp >= cutoff)
      if (relevantRecords.length === 0) return 100

      let uptimeMs = 0
      let totalMs = 0

      for (let i = 1; i < relevantRecords.length; i++) {
        const prev = relevantRecords[i - 1]
        const curr = relevantRecords[i]
        const duration = curr.timestamp.getTime() - prev.timestamp.getTime()
        totalMs += duration
        if (prev.status === 'up') {
          uptimeMs += duration
        }
      }

      return totalMs > 0 ? Math.round((uptimeMs / totalMs) * 10000) / 100 : 100
    }

    it('returns 100% for no records', () => {
      expect(calculateUptime([], 30)).toBe(100)
    })

    it('returns 100% for single record', () => {
      const records = [{ timestamp: new Date(), status: 'up' as const }]
      expect(calculateUptime(records, 30)).toBe(100)
    })

    it('calculates uptime correctly', () => {
      const now = new Date()
      const records: HealthRecord[] = [
        { timestamp: new Date(now.getTime() - 2 * 60 * 60 * 1000), status: 'up' }, // 2 hours ago
        { timestamp: new Date(now.getTime() - 1 * 60 * 60 * 1000), status: 'down' }, // 1 hour ago
        { timestamp: now, status: 'up' }, // Now
      ]
      const uptime = calculateUptime(records, 1)
      expect(uptime).toBe(50) // 1 hour up, 1 hour down = 50%
    })
  })

  describe('Alert Thresholds', () => {
    interface AlertConfig {
      latencyWarningMs: number
      latencyCriticalMs: number
      errorRateWarning: number
      errorRateCritical: number
    }

    const DEFAULT_CONFIG: AlertConfig = {
      latencyWarningMs: 1000,
      latencyCriticalMs: 5000,
      errorRateWarning: 0.01, // 1%
      errorRateCritical: 0.05, // 5%
    }

    type AlertLevel = 'none' | 'warning' | 'critical'

    const getAlertLevel = (latencyMs: number, errorRate: number, config = DEFAULT_CONFIG): AlertLevel => {
      if (latencyMs >= config.latencyCriticalMs || errorRate >= config.errorRateCritical) {
        return 'critical'
      }
      if (latencyMs >= config.latencyWarningMs || errorRate >= config.errorRateWarning) {
        return 'warning'
      }
      return 'none'
    }

    it('returns none for healthy metrics', () => {
      expect(getAlertLevel(100, 0.001)).toBe('none')
    })

    it('returns warning for high latency', () => {
      expect(getAlertLevel(1500, 0)).toBe('warning')
    })

    it('returns critical for very high latency', () => {
      expect(getAlertLevel(6000, 0)).toBe('critical')
    })

    it('returns warning for elevated error rate', () => {
      expect(getAlertLevel(100, 0.02)).toBe('warning')
    })

    it('returns critical for high error rate', () => {
      expect(getAlertLevel(100, 0.06)).toBe('critical')
    })
  })
})
