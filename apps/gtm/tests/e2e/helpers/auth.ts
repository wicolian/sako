import { expect, type Page } from '@playwright/test'

export function hasE2ECredentials(): boolean {
  return Boolean(process.env.TEST_USER_EMAIL && process.env.TEST_USER_PASSWORD)
}

export async function loginWithTestUser(page: Page): Promise<void> {
  const email = process.env.TEST_USER_EMAIL
  const password = process.env.TEST_USER_PASSWORD

  if (!email || !password) {
    throw new Error('TEST_USER_EMAIL and TEST_USER_PASSWORD are required for authenticated E2E flows.')
  }

  await page.goto('/login')
  await page.getByLabel(/work email/i).fill(email)
  await page.getByLabel(/password/i).fill(password)
  await page.getByRole('button', { name: /sign in/i }).click()
  await expect(page).toHaveURL(/\/(dashboard|onboarding)/)
}
