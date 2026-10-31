import { test, expect } from '@playwright/test'

/**
 * Claims Validation API E2E Tests
 * 
 * Tests the public ClaimsOS validation API.
 */

test.describe('Claims Validation API', () => {
  const API_URL = '/api/v1/validate'
  const apiKey = process.env.TEST_PUBLIC_API_KEY

  test.describe('with a real workspace API key', () => {
    test.skip(!apiKey, 'TEST_PUBLIC_API_KEY is required for authenticated public API validation tests')

    test('validates single claim', async ({ request }) => {
      const response = await request.post(API_URL, {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey!,
        },
        data: {
          claims: ['Our product is the best in the market'],
        },
      })

      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.results).toHaveLength(1)
      expect(data.results[0]).toHaveProperty('status')
      expect(data.results[0]).toHaveProperty('riskLevel')
      expect(data.results[0]).toHaveProperty('issues')
      expect(data.summary.total).toBe(1)
    })

    test('validates multiple claims', async ({ request }) => {
      const claims = [
        'Enterprise-grade security',
        '10x faster than competitors',
        'Guaranteed results in 30 days',
      ]

      const response = await request.post(API_URL, {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey!,
        },
        data: { claims },
      })

      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.results).toHaveLength(3)
      expect(data.summary.total).toBe(3)
    })

    test('returns error for empty claims', async ({ request }) => {
      const response = await request.post(API_URL, {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey!,
        },
        data: {
          claims: [],
        },
      })

      expect(response.status()).toBe(400)

      const data = await response.json()
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('INVALID_REQUEST')
    })

    test('enforces claim limit', async ({ request }) => {
      const claims = Array.from({ length: 101 }, (_, i) => `Claim ${i + 1}`)

      const response = await request.post(API_URL, {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey!,
        },
        data: { claims },
      })

      expect(response.status()).toBe(400)

      const data = await response.json()
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('LIMIT_EXCEEDED')
    })

    test('supports rules-only mode', async ({ request }) => {
      const response = await request.post(API_URL, {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey!,
        },
        data: {
          claims: ['Our solution is #1 in the industry'],
          options: { enhanced: false },
        },
      })

      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.results[0].riskLevel).not.toBe('low')
    })
  })

  test('returns error without API key', async ({ request }) => {
    const response = await request.post(API_URL, {
      headers: {
        'Content-Type': 'application/json',
      },
      data: {
        claims: ['Test claim'],
      },
    })

    expect(response.status()).toBe(401)

    const data = await response.json()
    expect(data.success).toBe(false)
    expect(data.error.code).toBe('UNAUTHORIZED')
  })
})
