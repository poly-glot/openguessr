import { test, expect } from '@playwright/test'

test.describe('Authentication Dialog', () => {
  test('should show auth dialog when visiting with roomId', async ({ page }) => {
    await page.goto('/?roomId=test-room')

    const dialog = page.locator('.auth-dialog')
    await expect(dialog).toBeVisible()

    // Landing should be hidden, app should be visible
    await expect(page.locator('#landing-page')).toBeHidden()
    await expect(page.locator('#app-view')).toBeVisible()
  })

  test('should show auth dialog when clicking start game from landing', async ({ page }) => {
    await page.goto('/')
    await page.click('[data-cy="start-game"]')

    const dialog = page.locator('.auth-dialog')
    await expect(dialog).toBeVisible({ timeout: 5000 })
  })

  test('should display username input with correct attributes', async ({ page }) => {
    await page.goto('/?roomId=test-room')

    const input = page.locator('[data-cy="username"]')
    await expect(input).toBeVisible()
    await expect(input).toHaveAttribute('maxlength', '32')
    await expect(input).toHaveAttribute('autocomplete', 'off')
  })

  test('should show error for empty username submission', async ({ page }) => {
    await page.goto('/?roomId=test-room')
    await expect(page.locator('.auth-dialog')).toBeVisible()

    await page.click('[data-cy="submit"]')

    const error = page.locator('.auth-dialog .form__error')
    await expect(error).toContainText('Invalid username')
  })

  test('should mark input as aria-invalid on error', async ({ page }) => {
    await page.goto('/?roomId=test-room')
    await expect(page.locator('.auth-dialog')).toBeVisible()

    await page.click('[data-cy="submit"]')

    const input = page.locator('[data-cy="username"]')
    await expect(input).toHaveAttribute('aria-invalid', 'true')
  })

  test('close button should hide dialog and show landing', async ({ page }) => {
    await page.goto('/?roomId=test-room')
    await expect(page.locator('.auth-dialog')).toBeVisible()

    await page.click('[data-cy="dialog-close"]')

    await expect(page.locator('.auth-dialog')).toBeHidden()
    await expect(page.locator('#landing-page')).toBeVisible()
  })

  test('close button should remove roomId from URL', async ({ page }) => {
    await page.goto('/?roomId=test-room')
    await expect(page.locator('.auth-dialog')).toBeVisible()

    await page.click('[data-cy="dialog-close"]')

    await expect(page).not.toHaveURL(/roomId/)
  })

  test('dialog header should say OpenGuessr', async ({ page }) => {
    await page.goto('/?roomId=test-room')

    const header = page.locator('.auth-dialog .dialog__header h1')
    await expect(header).toContainText('OpenGuessr')
  })

  test('submit button should say PLAY', async ({ page }) => {
    await page.goto('/?roomId=test-room')

    const submit = page.locator('[data-cy="submit"]')
    await expect(submit).toContainText('PLAY')
  })
})
