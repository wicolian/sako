import { test, expect } from '@playwright/test'
import { hasE2ECredentials, loginWithTestUser } from './helpers/auth'

/**
 * Dashboard E2E Tests
 * 
 * Tests for the main dashboard functionality.
 * Note: These tests require authentication to fully pass.
 */

test.describe('Dashboard', () => {
  test.describe('unauthenticated', () => {
    test('redirects to login when not authenticated', async ({ page }) => {
      await page.goto('/dashboard')
      
      // Should redirect to login
      await expect(page).toHaveURL(/\/login/)
    })
  })

  test.describe('authenticated', () => {
    test.skip(
      !hasE2ECredentials(),
      'Test credentials not configured'
    )

    test.beforeEach(async ({ page }) => {
      await loginWithTestUser(page)
    })

    test('displays dashboard content', async ({ page }) => {
      await page.goto('/dashboard')
      
      // Check for dashboard elements
      await expect(page.locator('main')).toBeVisible()
    })

    test('has create campaign CTA', async ({ page }) => {
      await page.goto('/dashboard')
      
      // Look for the primary CTA
      const createButton = page.getByRole('link', { name: /create|new campaign/i })
      await expect(createButton).toBeVisible()
    })

    test('shows work buckets', async ({ page }) => {
      await page.goto('/dashboard')
      
      // Dashboard should show work status buckets
      await expect(page.getByText(/draft|ready|live/i).first()).toBeVisible()
    })

    test('can reach billing settings from a signed-in session', async ({ page }) => {
      await page.goto('/settings?tab=billing')
      await expect(page.locator('main')).toBeVisible()
      await expect(page.getByText(/billing|plan|subscription/i).first()).toBeVisible()
    })
  })
})
