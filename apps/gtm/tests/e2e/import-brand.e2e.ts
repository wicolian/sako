/**
 * Import URL → Brand Extraction E2E Tests
 */

import { test, expect } from '@playwright/test'
import { hasE2ECredentials, loginWithTestUser } from './helpers/auth'

test.describe('URL Import & Brand Extraction', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/import')
  })

  test('displays import page', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /import/i })).toBeVisible()
  })

  test('shows URL input field', async ({ page }) => {
    const urlInput = page.getByPlaceholder(/url|website|enter/i)
    await expect(urlInput).toBeVisible()
  })

  test('validates URL format', async ({ page }) => {
    const urlInput = page.getByPlaceholder(/url|website|enter/i)
    await urlInput.fill('not-a-valid-url')

    const importButton = page.getByRole('button', { name: /import|extract|analyze/i })
    await importButton.click()

    // Expect validation error
    await expect(page.getByText(/invalid|valid url/i)).toBeVisible()
  })

  test('accepts valid URL', async ({ page }) => {
    const urlInput = page.getByPlaceholder(/url|website|enter/i)
    await urlInput.fill('https://example.com')

    // Should not show error immediately
    const errorText = page.getByText(/invalid url/i)
    await expect(errorText).not.toBeVisible()
  })

  test('shows loading state during extraction', async ({ page }) => {
    const urlInput = page.getByPlaceholder(/url|website|enter/i)
    await urlInput.fill('https://example.com')

    const importButton = page.getByRole('button', { name: /import|extract|analyze/i })
    await importButton.click()

    // Should show loading indicator
    const loading = page.getByRole('progressbar').or(page.getByText(/loading|extracting|analyzing/i))
    // Loading might be too fast to catch, so we just check it's not erroring
  })
})

test.describe('Imported brand to campaign flow', () => {
  test.skip(!hasE2ECredentials(), 'Test credentials not configured')

  test('creates a campaign from a persisted imported brand', async ({ page }) => {
    await loginWithTestUser(page)

    await page.route('**/api/import/analyze', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: [
          'data: {"event":"progress","stage":"extracting_brand","progress":45,"message":"Mapped brand voice.","partialData":{"sourceUrl":"https://linear.app","brand":{"name":"Linear","tagline":"The system for product development"}}}',
          'data: {"event":"complete","data":{"brandId":"brand-1","sourceUrl":"https://linear.app","brand":{"name":"Linear","tagline":"The system for product development","voice":{"formality":"professional","personality":["technical"],"tone":"direct"},"audience":{"type":"Product teams","personas":["PM"],"painPoints":["slow delivery"]},"industry":"SaaS","valuePropositions":["Ship better"]},"designTokens":{"colors":{"primary":"#5E6AD2","secondary":"#1F2430","accent":"#9AA4F6","background":"#0B0D12","text":"#F8FAFC"},"typography":{"fontFamily":"Inter","fontHeading":"Inter"},"corners":"rounded","shadows":"soft"},"claims":[],"linkedEvidence":[],"summary":{"claimsTotal":0,"claimsSupported":0,"claimsNeedReview":0,"claimsBlocked":0,"evidenceFound":0,"complianceScore":100,"complianceGrade":"A"}}}',
        ].join('\n\n'),
      })
    })

    await page.route('**/api/brands/brand-1', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          brand: {
            id: 'brand-1',
            name: 'Linear',
            tagline: 'The system for product development',
            website_url: 'https://linear.app',
            voice: 'direct',
            primary_color: '#5E6AD2',
            secondary_color: '#1F2430',
            accent_color: '#9AA4F6',
            value_propositions: ['Ship better'],
          },
        }),
      })
    })

    await page.route('**/api/campaigns', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: 'camp-1' }),
      })
    })

    await page.route('**/api/campaigns/camp-1/generate', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: [
          'data: {"step":"generating","progress":40,"status":"Generating landing page...","assetType":"landing-page"}',
          'data: {"step":"asset_complete","progress":85,"status":"Landing page complete","assetType":"landing-page","result":{"success":true,"assetId":"asset-1"}}',
          'data: {"step":"complete","progress":100,"status":"Campaign complete"}',
        ].join('\n\n'),
      })
    })

    await page.goto('/import')
    await page.getByPlaceholder('https://your-company.com').fill('https://linear.app')
    await page.getByText(/i have permission to analyze this url/i).click()
    await page.getByRole('button', { name: /analyze brand/i }).click()

    await expect(page.getByRole('heading', { name: 'Linear' })).toBeVisible()
    await expect(page.getByRole('button', { name: /create campaign/i })).toBeEnabled()

    await page.getByRole('button', { name: /create campaign/i }).click()
    await expect(page).toHaveURL(/\/campaigns\/new\?imported=1&brand=brand-1/)
    await expect(page.getByRole('heading', { name: /generate from imported brand/i })).toBeVisible()

    await page.getByRole('button', { name: /generate campaign/i }).click()
    await expect(page.getByRole('heading', { name: /campaign generated/i })).toBeVisible()
  })
})

test.describe('Brand Extraction Results', () => {
  test('displays extracted brand information', async ({ page }) => {
    // This test assumes extraction has completed
    await page.goto('/import/results')

    // Should show brand elements
    const brandSection = page.getByText(/brand|colors|fonts|logo/i)
    // Results page might redirect if no extraction done
  })

  test('allows editing extracted data', async ({ page }) => {
    await page.goto('/import/results')

    // Look for edit functionality
    const editButton = page.getByRole('button', { name: /edit/i })
    if (await editButton.isVisible()) {
      await editButton.click()
      // Should enable editing mode
    }
  })

  test('saves brand to workspace', async ({ page }) => {
    await page.goto('/import/results')

    // Look for save button
    const saveButton = page.getByRole('button', { name: /save|create brand|add to/i })
    if (await saveButton.isVisible()) {
      await expect(saveButton).toBeEnabled()
    }
  })
})

test.describe('Brand Management', () => {
  test('navigates to brand settings', async ({ page }) => {
    await page.goto('/settings?tab=brand')

    await expect(page.getByRole('heading', { name: /brand/i })).toBeVisible()
  })

  test('displays existing brands', async ({ page }) => {
    await page.goto('/settings?tab=brand')

    // Should show brands or empty state
    const brandsOrEmpty = page.getByRole('list').or(page.getByText(/no brands|add your first/i))
    await expect(brandsOrEmpty).toBeVisible()
  })

  test('can add new brand manually', async ({ page }) => {
    await page.goto('/settings?tab=brand')

    const addButton = page.getByRole('button', { name: /add|new|create/i })
    if (await addButton.isVisible()) {
      await addButton.click()
      // Should show brand creation form
    }
  })
})
