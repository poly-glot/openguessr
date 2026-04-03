import { test, expect } from '@playwright/test'

test.describe('Leaderboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?roomId=test-room')
  })

  test('should have leaderboard title', async ({ page }) => {
    const title = page.locator('.leaderboard__title')
    await expect(title).toContainText('Leaderboard')
  })

  test('should have leaderboard list container', async ({ page }) => {
    const list = page.locator('#js-leaderboard-list')
    await expect(list).toBeVisible()
  })

  test('leaderboard should be inside sidebar', async ({ page }) => {
    const sidebar = page.locator('.game-sidebar')
    await expect(sidebar).toBeVisible()

    const leaderboard = sidebar.locator('.leaderboard')
    await expect(leaderboard).toBeVisible()
  })
})
