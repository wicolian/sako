/**
 * Settings Page E2E Tests
 */

import { test, expect } from '@playwright/test'

test.describe('Settings Navigation', () => {
  test('navigates to settings page', async ({ page }) => {
    await page.goto('/settings')
    await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible()
  })

  test('displays all tabs', async ({ page }) => {
    await page.goto('/settings')

    await expect(page.getByRole('tab', { name: /integrations/i })).toBeVisible()
    await expect(page.getByRole('tab', { name: /brand/i })).toBeVisible()
    await expect(page.getByRole('tab', { name: /compliance/i })).toBeVisible()
    await expect(page.getByRole('tab', { name: /api/i })).toBeVisible()
    await expect(page.getByRole('tab', { name: /billing/i })).toBeVisible()
  })

  test('switches between tabs', async ({ page }) => {
    await page.goto('/settings')

    // Click billing tab
    await page.getByRole('tab', { name: /billing/i }).click()
    await expect(page.getByText(/subscription|plan|billing/i)).toBeVisible()

    // Click compliance tab
    await page.getByRole('tab', { name: /compliance/i }).click()
    await expect(page.getByText(/forbidden|policy|compliance/i)).toBeVisible()
  })
})

test.describe('Integrations Tab', () => {
  test('displays integration options', async ({ page }) => {
    await page.goto('/settings?tab=integrations')

    // Should show various integrations
    await expect(page.getByText(/hubspot/i)).toBeVisible()
    await expect(page.getByText(/webflow/i)).toBeVisible()
  })

  test('shows observability dashboard', async ({ page }) => {
    await page.goto('/settings?tab=integrations')

    // Should show AI observability section
    await expect(page.getByText(/observability|tracing/i)).toBeVisible()
  })

  test('shows connect buttons for disconnected services', async ({ page }) => {
    await page.goto('/settings?tab=integrations')

    // Should have connect buttons
    const connectButtons = page.getByRole('button', { name: /connect/i })
    await expect(connectButtons.first()).toBeVisible()
  })
})

test.describe('Compliance Tab', () => {
  test('displays forbidden phrases section', async ({ page }) => {
    await page.goto('/settings?tab=compliance')

    await expect(page.getByText(/forbidden phrases/i)).toBeVisible()
  })

  test('can add forbidden phrase', async ({ page }) => {
    await page.goto('/settings?tab=compliance')

    const input = page.getByPlaceholder(/add.*phrase/i)
    if (await input.isVisible()) {
      await input.fill('test phrase')
      await page.getByRole('button', { name: /add/i }).click()

      // Should show the phrase
      await expect(page.getByText('test phrase')).toBeVisible()
    }
  })

  test('displays policy templates', async ({ page }) => {
    await page.goto('/settings?tab=compliance')

    await expect(page.getByText(/policy|template/i)).toBeVisible()
  })
})

test.describe('API Keys Tab', () => {
  test('displays API keys section', async ({ page }) => {
    await page.goto('/settings?tab=api')

    await expect(page.getByRole('heading', { name: /api keys/i })).toBeVisible()
  })

  test('shows generate key button', async ({ page }) => {
    await page.goto('/settings?tab=api')

    const generateButton = page.getByRole('button', { name: /generate|new|create/i })
    await expect(generateButton).toBeVisible()
  })

  test('shows API documentation', async ({ page }) => {
    await page.goto('/settings?tab=api')

    await expect(page.getByText(/documentation|curl|api/i)).toBeVisible()
  })
})

test.describe('Billing Tab', () => {
  test('displays current plan', async ({ page }) => {
    await page.goto('/settings?tab=billing')

    await expect(page.getByText(/plan|subscription/i)).toBeVisible()
  })

  test('shows budget management', async ({ page }) => {
    await page.goto('/settings?tab=billing')

    await expect(page.getByText(/budget/i)).toBeVisible()
  })

  test('displays usage stats', async ({ page }) => {
    await page.goto('/settings?tab=billing')

    await expect(page.getByText(/usage|spent|cost/i)).toBeVisible()
  })
})
