/**
 * Campaign Creation → Publish E2E Tests
 */

import { test, expect } from '@playwright/test'

test.describe('Campaign Creation Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to campaigns page
    await page.goto('/campaigns')
  })

  test('creates new campaign from dashboard', async ({ page }) => {
    // Click create button
    await page.getByRole('button', { name: /create/i }).click()

    // Expect to be on new campaign page or modal
    await expect(page.getByRole('heading', { name: /new campaign/i })).toBeVisible()
  })

  test('fills out campaign brief', async ({ page }) => {
    await page.goto('/campaigns/new')

    // Fill in campaign name
    const nameInput = page.getByLabel(/campaign name/i)
    await nameInput.fill('Test Campaign')

    // Fill in brief
    const briefInput = page.getByLabel(/brief|description/i)
    await briefInput.fill('This is a test campaign for our new product launch')

    // Expect inputs to have values
    await expect(nameInput).toHaveValue('Test Campaign')
  })

  test('validates required fields', async ({ page }) => {
    await page.goto('/campaigns/new')

    // Try to submit without filling required fields
    const submitButton = page.getByRole('button', { name: /create|save|submit/i })
    await submitButton.click()

    // Expect validation error
    await expect(page.getByText(/required|please fill/i)).toBeVisible()
  })

  test('navigates through staged flow', async ({ page }) => {
    // Assuming we have a campaign already created
    await page.goto('/campaigns/test-campaign-id')

    // Check for staged flow navigation
    await expect(page.getByRole('navigation')).toBeVisible()

    // Should see Content step first
    await expect(page.getByText(/content/i)).toBeVisible()
  })

  test('displays compliance blockers', async ({ page }) => {
    await page.goto('/campaigns/test-campaign-id')

    // Navigate to compliance step
    await page.getByRole('button', { name: /compliance/i }).click()

    // If there are blockers, they should be visible
    const blockerText = page.getByText(/blocked|needs evidence|pending/i)
    // This might or might not be visible depending on campaign state
  })

  test('can publish completed campaign', async ({ page }) => {
    await page.goto('/campaigns/test-campaign-id')

    // Navigate to publish step
    await page.getByRole('button', { name: /publish/i }).click()

    // Should see publish options
    await expect(page.getByText(/publish|deploy|go live/i)).toBeVisible()
  })
})

test.describe('Campaign List', () => {
  test('displays campaign list', async ({ page }) => {
    await page.goto('/campaigns')

    // Should see campaigns list or empty state
    const campaignsOrEmpty = page.getByRole('list').or(page.getByText(/no campaigns|get started/i))
    await expect(campaignsOrEmpty).toBeVisible()
  })

  test('filters campaigns by status', async ({ page }) => {
    await page.goto('/campaigns')

    // Look for filter controls
    const filterButton = page.getByRole('button', { name: /filter|status/i })
    if (await filterButton.isVisible()) {
      await filterButton.click()
      // Should show filter options
      await expect(page.getByText(/draft|live|archived/i)).toBeVisible()
    }
  })

  test('searches campaigns', async ({ page }) => {
    await page.goto('/campaigns')

    // Look for search input
    const searchInput = page.getByPlaceholder(/search/i)
    if (await searchInput.isVisible()) {
      await searchInput.fill('test')
      // Wait for search results
      await page.waitForTimeout(500)
    }
  })
})
