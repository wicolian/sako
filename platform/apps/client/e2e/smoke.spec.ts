import { test, expect } from '@playwright/test';

/**
 * Smoke Tests for Sako Client App
 * 
 * These tests verify basic functionality without requiring authentication.
 * For full E2E tests with auth, see auth.spec.ts
 */

test.describe('Smoke Tests', () => {
  test('homepage redirects to sign-in for unauthenticated users', async ({ page }) => {
    await page.goto('/');
    
    // Should redirect to Clerk sign-in
    await expect(page).toHaveURL(/sign-in|login/);
  });

  test('sign-in page loads correctly', async ({ page }) => {
    await page.goto('/sign-in');
    
    // Clerk sign-in component should be present
    await expect(page.locator('[data-clerk-component]')).toBeVisible({ timeout: 10000 });
  });

  test('sign-up page loads correctly', async ({ page }) => {
    await page.goto('/sign-up');
    
    // Clerk sign-up component should be present
    await expect(page.locator('[data-clerk-component]')).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Error Handling', () => {
  test('404 page renders for invalid routes', async ({ page }) => {
    await page.goto('/this-route-does-not-exist-12345');
    
    // Should show some kind of error or redirect
    // The exact behavior depends on your router config
    const body = await page.textContent('body');
    expect(body).toBeTruthy();
  });
});

/**
 * Authenticated Test Skeleton
 * 
 * To run authenticated tests, you need to:
 * 1. Set up a test user in Clerk
 * 2. Use Playwright's storageState to persist auth
 * 
 * Example setup (add to e2e/auth.setup.ts):
 * 
 * import { test as setup, expect } from '@playwright/test';
 * 
 * setup('authenticate', async ({ page }) => {
 *   await page.goto('/sign-in');
 *   await page.fill('input[name="email"]', process.env.TEST_USER_EMAIL);
 *   await page.fill('input[name="password"]', process.env.TEST_USER_PASSWORD);
 *   await page.click('button[type="submit"]');
 *   await page.waitForURL('/dashboard');
 *   await page.context().storageState({ path: 'e2e/.auth/user.json' });
 * });
 */

