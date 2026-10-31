import { test, expect } from '@playwright/test'

/**
 * Smoke Tests
 * 
 * Basic tests to verify the app loads and critical pages are accessible.
 */

test.describe('Smoke Tests', () => {
  test('homepage redirects to dashboard or login', async ({ page }) => {
    await page.goto('/')
    
    // Should redirect to dashboard (if authenticated) or login (if not)
    await expect(page).toHaveURL(/\/(dashboard|login)/)
  })

  test('login page loads', async ({ page }) => {
    await page.goto('/login')
    
    // Should have login form or content
    await expect(page.locator('body')).toBeVisible()
  })

  test('API health endpoint responds', async ({ request }) => {
    const response = await request.get('/api/health')
    
    expect(response.status()).toBe(200)
  })

  test('setup status endpoint responds', async ({ request }) => {
    const response = await request.get('/api/setup/status')
    
    expect(response.status()).toBe(200)
    
    const data = await response.json()
    expect(data).toHaveProperty('ready')
    expect(data).toHaveProperty('config')
    expect(data).toHaveProperty('services')
    expect(data).toHaveProperty('summary')
  })

  test('public validation API is accessible', async ({ request }) => {
    const response = await request.get('/api/v1/validate')
    
    expect(response.status()).toBe(200)
    
    const data = await response.json()
    expect(data).toHaveProperty('name', 'ClaimsOS Validation API')
    expect(data).toHaveProperty('version', '1.0.0')
  })
})
