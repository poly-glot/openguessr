import { test, expect } from '@playwright/test'

test.describe('Share Link & Toolbar', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?roomId=test-room')
  })

  test('should have copy link button with correct text', async ({ page }) => {
    const btn = page.locator('[data-cy="copy"]')
    await expect(btn).toBeVisible()
    await expect(btn).toContainText('Copy & Share Link')
  })

  test('should have sign out button with correct text', async ({ page }) => {
    const btn = page.locator('[data-cy="signout"]')
    await expect(btn).toBeVisible()
    await expect(btn).toContainText('Sign out')
  })

  test('toolbar buttons should be inside notification bar', async ({ page }) => {
    const toolbar = page.locator('.site__notification [data-cy="toolbar"]')
    await expect(toolbar).toBeVisible()

    const copy = toolbar.locator('[data-cy="copy"]')
    await expect(copy).toBeVisible()

    const signout = toolbar.locator('[data-cy="signout"]')
    await expect(signout).toBeVisible()
  })
})
