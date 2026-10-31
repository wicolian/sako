/**
 * Budget Enforcement Unit Tests
 * 
 * Tests the budget hard cap system.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { BudgetExceededError } from '@/lib/enterprise/budget-enforcement'

// Mock the supabase service client
vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: { settings: {} } })),
          gte: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({ data: null })),
          })),
        })),
      })),
      insert: vi.fn(() => Promise.resolve({ error: null })),
      update: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ error: null })),
      })),
    })),
  })),
}))

// Mock the tracing module
vi.mock('@/lib/ai/tracing', () => ({
  getWorkspaceCosts: vi.fn(() => Promise.resolve({ totalCost: 0, byModel: {}, byDay: [] })),
}))

describe('Budget Enforcement', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // =========================================================================
  // BudgetExceededError
  // =========================================================================

  describe('BudgetExceededError', () => {
    it('creates error with correct properties', () => {
      const error = new BudgetExceededError('Budget exceeded', {
        currentSpend: 10000,
        hardCap: 5000,
        percentUsed: 200,
      })

      expect(error.name).toBe('BudgetExceededError')
      expect(error.code).toBe('BUDGET_EXCEEDED')
      expect(error.message).toBe('Budget exceeded')
      expect(error.details.currentSpend).toBe(10000)
      expect(error.details.hardCap).toBe(5000)
      expect(error.details.percentUsed).toBe(200)
    })

    it('is instanceof Error', () => {
      const error = new BudgetExceededError('Test', { currentSpend: 0, hardCap: 0 })
      expect(error).toBeInstanceOf(Error)
    })

    it('includes estimated cost when provided', () => {
      const error = new BudgetExceededError('Test', {
        currentSpend: 4500,
        hardCap: 5000,
        estimatedCost: 1000,
      })

      expect(error.details.estimatedCost).toBe(1000)
    })
  })

  // =========================================================================
  // Budget Status Calculation
  // =========================================================================

  describe('Budget Status Logic', () => {
    const calculateStatus = (currentSpend: number, hardCap: number | null) => {
      const percentUsed = hardCap ? (currentSpend / hardCap) * 100 : null
      const remaining = hardCap ? Math.max(0, hardCap - currentSpend) : null
      const isBlocked = hardCap !== null && currentSpend >= hardCap

      let alertLevel: 'normal' | 'warning' | 'critical' | 'exceeded' = 'normal'
      if (percentUsed !== null) {
        if (percentUsed >= 100) alertLevel = 'exceeded'
        else if (percentUsed >= 90) alertLevel = 'critical'
        else if (percentUsed >= 80) alertLevel = 'warning'
      }

      return { percentUsed, remaining, isBlocked, alertLevel }
    }

    it('returns null for unlimited budget', () => {
      const status = calculateStatus(5000, null)

      expect(status.percentUsed).toBeNull()
      expect(status.remaining).toBeNull()
      expect(status.isBlocked).toBe(false)
      expect(status.alertLevel).toBe('normal')
    })

    it('calculates percentage correctly', () => {
      const status = calculateStatus(2500, 5000)

      expect(status.percentUsed).toBe(50)
      expect(status.remaining).toBe(2500)
      expect(status.isBlocked).toBe(false)
    })

    it('blocks when at or over cap', () => {
      const atCap = calculateStatus(5000, 5000)
      expect(atCap.isBlocked).toBe(true)
      expect(atCap.alertLevel).toBe('exceeded')

      const overCap = calculateStatus(6000, 5000)
      expect(overCap.isBlocked).toBe(true)
      expect(overCap.remaining).toBe(0)
    })

    it('sets warning alert level at 80%', () => {
      const status = calculateStatus(4000, 5000)
      expect(status.alertLevel).toBe('warning')
    })

    it('sets critical alert level at 90%', () => {
      const status = calculateStatus(4500, 5000)
      expect(status.alertLevel).toBe('critical')
    })

    it('sets exceeded alert level at 100%', () => {
      const status = calculateStatus(5000, 5000)
      expect(status.alertLevel).toBe('exceeded')
    })
  })

  // =========================================================================
  // Budget Forecast
  // =========================================================================

  describe('Budget Forecast Logic', () => {
    const calculateForecast = (
      currentSpend: number,
      hardCap: number | null,
      dayOfMonth: number,
      daysInMonth: number
    ) => {
      const daysRemaining = daysInMonth - dayOfMonth
      const dailyAverage = dayOfMonth > 0 ? currentSpend / dayOfMonth : 0
      const endOfMonthEstimate = Math.round(dailyAverage * daysInMonth)

      let willExceed = false
      let daysUntilExceeded: number | null = null

      if (hardCap !== null) {
        willExceed = endOfMonthEstimate > hardCap

        if (dailyAverage > 0 && hardCap > currentSpend) {
          daysUntilExceeded = Math.ceil((hardCap - currentSpend) / dailyAverage)
        } else if (currentSpend >= hardCap) {
          daysUntilExceeded = 0
        }
      }

      return { endOfMonthEstimate, willExceed, daysUntilExceeded }
    }

    it('projects end of month spend linearly', () => {
      // Day 10 of 30, spent $1000 = ~$3000 projected
      const forecast = calculateForecast(1000, 5000, 10, 30)

      expect(forecast.endOfMonthEstimate).toBe(3000)
      expect(forecast.willExceed).toBe(false)
    })

    it('detects when forecast exceeds budget', () => {
      // Day 10 of 30, spent $2000 = ~$6000 projected (exceeds $5000 cap)
      const forecast = calculateForecast(2000, 5000, 10, 30)

      expect(forecast.endOfMonthEstimate).toBe(6000)
      expect(forecast.willExceed).toBe(true)
    })

    it('calculates days until exceeded', () => {
      // Spending $100/day, have $200 left
      // ($5000 - $4800) / ($4800 / 24 days) = 200 / 200 = 1 day
      const forecast = calculateForecast(4800, 5000, 24, 30)

      expect(forecast.daysUntilExceeded).toBe(1)
    })

    it('returns 0 days if already exceeded', () => {
      const forecast = calculateForecast(6000, 5000, 20, 30)

      expect(forecast.daysUntilExceeded).toBe(0)
    })

    it('handles unlimited budget', () => {
      const forecast = calculateForecast(10000, null, 15, 30)

      expect(forecast.willExceed).toBe(false)
      expect(forecast.daysUntilExceeded).toBeNull()
    })

    it('handles first day of month', () => {
      const forecast = calculateForecast(0, 5000, 0, 30)

      expect(forecast.endOfMonthEstimate).toBe(0)
      expect(forecast.willExceed).toBe(false)
    })
  })

  // =========================================================================
  // Alert Thresholds
  // =========================================================================

  describe('Alert Threshold Logic', () => {
    const DEFAULT_THRESHOLDS = [50, 80, 90, 100]

    const getTriggeredThresholds = (percentUsed: number, thresholds: number[]) => {
      return thresholds.filter(t => percentUsed >= t)
    }

    it('triggers 50% threshold', () => {
      const triggered = getTriggeredThresholds(55, DEFAULT_THRESHOLDS)
      expect(triggered).toContain(50)
      expect(triggered).not.toContain(80)
    })

    it('triggers multiple thresholds', () => {
      const triggered = getTriggeredThresholds(85, DEFAULT_THRESHOLDS)
      expect(triggered).toEqual([50, 80])
    })

    it('triggers all thresholds at 100%', () => {
      const triggered = getTriggeredThresholds(100, DEFAULT_THRESHOLDS)
      expect(triggered).toEqual([50, 80, 90, 100])
    })

    it('triggers no thresholds below 50%', () => {
      const triggered = getTriggeredThresholds(45, DEFAULT_THRESHOLDS)
      expect(triggered).toHaveLength(0)
    })
  })

  // =========================================================================
  // Budget Config Parsing
  // =========================================================================

  describe('Budget Config Parsing', () => {
    const parseBudgetConfig = (settings: Record<string, unknown> = {}) => ({
      monthlyHardCapCents: (settings.budget_hard_cap_cents as number) ?? null,
      alertThresholds: (settings.budget_alert_thresholds as number[]) ?? [50, 80, 90, 100],
      notifyEmails: (settings.budget_notify_emails as string[]) ?? [],
      autoTopUp: (settings.budget_auto_top_up as boolean) ?? false,
      autoTopUpAmount: (settings.budget_auto_top_up_amount as number) ?? 10000,
    })

    it('parses complete config', () => {
      const config = parseBudgetConfig({
        budget_hard_cap_cents: 50000,
        budget_alert_thresholds: [25, 50, 75],
        budget_notify_emails: ['admin@example.com'],
        budget_auto_top_up: true,
        budget_auto_top_up_amount: 25000,
      })

      expect(config.monthlyHardCapCents).toBe(50000)
      expect(config.alertThresholds).toEqual([25, 50, 75])
      expect(config.notifyEmails).toEqual(['admin@example.com'])
      expect(config.autoTopUp).toBe(true)
      expect(config.autoTopUpAmount).toBe(25000)
    })

    it('provides defaults for missing fields', () => {
      const config = parseBudgetConfig({})

      expect(config.monthlyHardCapCents).toBeNull()
      expect(config.alertThresholds).toEqual([50, 80, 90, 100])
      expect(config.notifyEmails).toEqual([])
      expect(config.autoTopUp).toBe(false)
      expect(config.autoTopUpAmount).toBe(10000)
    })
  })

  // =========================================================================
  // Dollar to Cents Conversion
  // =========================================================================

  describe('Dollar/Cents Conversion', () => {
    const dollarsToCents = (dollars: number) => Math.round(dollars * 100)
    const centsToDollars = (cents: number) => cents / 100
    const formatCents = (cents: number) => `$${centsToDollars(cents).toFixed(2)}`

    it('converts dollars to cents', () => {
      expect(dollarsToCents(100)).toBe(10000)
      expect(dollarsToCents(0.01)).toBe(1)
      expect(dollarsToCents(99.99)).toBe(9999)
    })

    it('converts cents to dollars', () => {
      expect(centsToDollars(10000)).toBe(100)
      expect(centsToDollars(1)).toBe(0.01)
    })

    it('formats cents as dollar string', () => {
      expect(formatCents(10000)).toBe('$100.00')
      expect(formatCents(1)).toBe('$0.01')
      expect(formatCents(12345)).toBe('$123.45')
    })

    it('handles rounding correctly', () => {
      expect(dollarsToCents(100.005)).toBe(10001) // Rounds
      expect(dollarsToCents(100.004)).toBe(10000) // Rounds
    })
  })
})
