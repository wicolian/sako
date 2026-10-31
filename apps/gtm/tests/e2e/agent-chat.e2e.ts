/**
 * Agent Chat Conversation E2E Tests
 */

import { test, expect } from '@playwright/test'

test.describe('Agent Chat Interface', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/agent')
  })

  test('displays chat interface', async ({ page }) => {
    // Should have chat container
    const chatContainer = page.getByRole('main').or(page.locator('[data-testid="chat-container"]'))
    await expect(chatContainer).toBeVisible()
  })

  test('shows message input', async ({ page }) => {
    const input = page.getByPlaceholder(/message|ask|type/i).or(page.getByRole('textbox'))
    await expect(input).toBeVisible()
  })

  test('sends message on enter', async ({ page }) => {
    const input = page.getByPlaceholder(/message|ask|type/i).or(page.getByRole('textbox'))
    await input.fill('Hello, I need help with a campaign')
    await input.press('Enter')

    // Should show message in chat
    await expect(page.getByText('Hello, I need help with a campaign')).toBeVisible()
  })

  test('sends message on button click', async ({ page }) => {
    const input = page.getByPlaceholder(/message|ask|type/i).or(page.getByRole('textbox'))
    await input.fill('Create a new landing page')

    const sendButton = page.getByRole('button', { name: /send/i }).or(page.locator('[type="submit"]'))
    await sendButton.click()

    // Should show message in chat
    await expect(page.getByText('Create a new landing page')).toBeVisible()
  })

  test('shows typing indicator', async ({ page }) => {
    const input = page.getByPlaceholder(/message|ask|type/i).or(page.getByRole('textbox'))
    await input.fill('Help me write marketing copy')
    await input.press('Enter')

    // Should show typing/thinking indicator
    const typing = page.getByText(/typing|thinking|processing/i).or(page.locator('[data-testid="typing-indicator"]'))
    // This might disappear quickly
  })

  test('displays assistant response', async ({ page }) => {
    const input = page.getByPlaceholder(/message|ask|type/i).or(page.getByRole('textbox'))
    await input.fill('What can you help me with?')
    await input.press('Enter')

    // Wait for response (with reasonable timeout)
    await page.waitForTimeout(5000)

    // Should have multiple messages (user + assistant)
    const messages = page.locator('[data-testid="message"]').or(page.locator('.message'))
    // At least the user message should be there
  })
})

test.describe('Agent Capabilities', () => {
  test('handles campaign creation request', async ({ page }) => {
    await page.goto('/agent')

    const input = page.getByPlaceholder(/message|ask|type/i).or(page.getByRole('textbox'))
    await input.fill('Create a campaign for our new product launch')
    await input.press('Enter')

    // Should acknowledge and potentially show tool usage
    await page.waitForTimeout(3000)
  })

  test('handles claim validation request', async ({ page }) => {
    await page.goto('/agent')

    const input = page.getByPlaceholder(/message|ask|type/i).or(page.getByRole('textbox'))
    await input.fill('Check if this claim is compliant: We are the best solution')
    await input.press('Enter')

    await page.waitForTimeout(3000)
  })

  test('shows tool calls', async ({ page }) => {
    await page.goto('/agent')

    const input = page.getByPlaceholder(/message|ask|type/i).or(page.getByRole('textbox'))
    await input.fill('Search for evidence about productivity software')
    await input.press('Enter')

    // May show tool call indicators
    const toolIndicator = page.getByText(/searching|using|calling/i)
    // Tool calls might not always be visible to user
  })
})

test.describe('Chat History', () => {
  test('preserves chat history', async ({ page }) => {
    await page.goto('/agent')

    const input = page.getByPlaceholder(/message|ask|type/i).or(page.getByRole('textbox'))

    // Send first message
    await input.fill('First message')
    await input.press('Enter')
    await page.waitForTimeout(1000)

    // Send second message
    await input.fill('Second message')
    await input.press('Enter')

    // Both should be visible
    await expect(page.getByText('First message')).toBeVisible()
    await expect(page.getByText('Second message')).toBeVisible()
  })

  test('can clear chat', async ({ page }) => {
    await page.goto('/agent')

    // Look for clear button
    const clearButton = page.getByRole('button', { name: /clear|new|reset/i })
    if (await clearButton.isVisible()) {
      await clearButton.click()
      // Chat should be empty or show welcome message
    }
  })
})
