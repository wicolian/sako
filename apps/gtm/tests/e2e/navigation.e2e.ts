import { test, expect } from '@playwright/test'

/**
 * Navigation E2E Tests
 * 
 * Tests for sidebar navigation and page accessibility.
 * Note: These tests run against public/unauthenticated pages where possible.
 */

test.describe('Navigation', () => {
  test.describe('public pages', () => {
    test('login page is accessible', async ({ page }) => {
      await page.goto('/login')
      
      // Should render without errors
      await expect(page.locator('body')).toBeVisible()
      
      // Should not show server error
      await expect(page.locator('text=Server Error')).not.toBeVisible()
    })

    test('signup page is accessible', async ({ page }) => {
      await page.goto('/signup')
      
      // Should render without errors
      await expect(page.locator('body')).toBeVisible()
    })
  })

  test.describe('protected pages redirect', () => {
    const protectedRoutes = [
      '/dashboard',
      '/campaigns',
      '/campaigns/new',
      '/claims',
      '/evidence',
      '/playground',
      '/agent',
      '/settings',
      '/analytics',
      '/compliance',
    ]

    for (const route of protectedRoutes) {
      test(`${route} redirects to login`, async ({ page }) => {
        await page.goto(route)
        
        // Should redirect to login when not authenticated
        await expect(page).toHaveURL(/\/login/)
      })
    }
  })

  test.describe('API routes', () => {
    test('campaigns API requires auth', async ({ request }) => {
      const response = await request.get('/api/campaigns')
      
      // Should return 401 or redirect
      expect([401, 302, 307]).toContain(response.status())
    })

    test('features API is accessible', async ({ request }) => {
      const response = await request.get('/api/features')
      
      // Features endpoint might work without auth for public features
      expect([200, 401]).toContain(response.status())
    })

    test('dashboard stats requires auth', async ({ request }) => {
      const response = await request.get('/api/dashboard/stats')
      
      // Should return 401 when not authenticated
      expect([401, 302, 307]).toContain(response.status())
    })
  })
})
