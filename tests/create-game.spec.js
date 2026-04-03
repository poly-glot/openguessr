import { test, expect } from '@playwright/test'

test.describe('Create Game after Login', () => {
  test('should create game without displayName error', async ({ page }) => {
    const errors = []
    page.on('pageerror', (err) => errors.push(err.message))

    // Go to landing page
    await page.goto('/')
    await expect(page.locator('#landing-page')).toBeVisible()

    // Click start game
    await page.click('[data-cy="start-game"]')
    await expect(page.locator('.auth-dialog')).toBeVisible({ timeout: 5000 })

    // Enter username and submit
    await page.fill('[data-cy="username"]', 'TestPlayer')
    await page.click('[data-cy="submit"]')

    // Wait for game to be created - roomId should appear in URL
    await expect(page).toHaveURL(/roomId=/, { timeout: 15000 })

    // Should show lobby/waiting state, not an error
    const alert = page.locator('[data-cy="notification"]')
    await expect(alert).not.toContainText('Failed to create game', { timeout: 5000 })

    // Auth dialog should be hidden after successful login
    await expect(page.locator('.auth-dialog')).toBeHidden({ timeout: 5000 })

    // No page errors related to displayName
    const displayNameErrors = errors.filter(e => e.includes('displayName'))
    expect(displayNameErrors).toHaveLength(0)
  })
})