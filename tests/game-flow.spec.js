import { test, expect } from '@playwright/test'

test.describe('Game View Structure', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?roomId=test-room')
  })

  test('should show app view when roomId is present', async ({ page }) => {
    await expect(page.locator('#app-view')).toBeVisible()
    await expect(page.locator('#landing-page')).toBeHidden()
  })

  test('should have round info with round label and timer', async ({ page }) => {
    const roundInfo = page.locator('.round-info')
    await expect(roundInfo).toBeVisible()

    const roundLabel = page.locator('#js-round-label')
    await expect(roundLabel).toBeVisible()

    const timer = page.locator('#js-timer')
    await expect(timer).toBeVisible()
  })

  test('should have street view area with placeholder', async ({ page }) => {
    const streetView = page.locator('#js-street-view')
    await expect(streetView).toBeVisible()

    const placeholder = page.locator('.street-view__placeholder')
    await expect(placeholder).toBeVisible()
  })

  test('should have score display section (initially hidden)', async ({ page }) => {
    const scoreDisplay = page.locator('#js-score-display')
    await expect(scoreDisplay).toBeHidden()
  })

  test('should have country picker area', async ({ page }) => {
    const picker = page.locator('#js-country-picker')
    await expect(picker).toBeVisible()
  })

  test('should have leaderboard sidebar', async ({ page }) => {
    const leaderboard = page.locator('#js-leaderboard')
    await expect(leaderboard).toBeVisible()

    const title = page.locator('.leaderboard__title')
    await expect(title).toContainText('Leaderboard')
  })

  test('should have notification bar with alert and toolbar', async ({ page }) => {
    const notification = page.locator('.site__notification')
    await expect(notification).toBeVisible()

    const alert = page.locator('[data-cy="notification"]')
    await expect(alert).toBeVisible()

    const toolbar = page.locator('[data-cy="toolbar"]')
    await expect(toolbar).toBeVisible()
  })

  test('should have Copy & Share Link button', async ({ page }) => {
    const btn = page.locator('[data-cy="copy"]')
    await expect(btn).toBeVisible()
    await expect(btn).toContainText('Copy & Share Link')
  })

  test('should have Sign out button', async ({ page }) => {
    const btn = page.locator('[data-cy="signout"]')
    await expect(btn).toBeVisible()
    await expect(btn).toContainText('Sign out')
  })

  test('should have host controls template', async ({ page }) => {
    // Template exists in the DOM but is not rendered until host connects
    const template = page.locator('.site__host-controls')
    await expect(template).toBeAttached()
  })

  test('score display should have motivation element', async ({ page }) => {
    const motivation = page.locator('#js-score-motivation')
    await expect(motivation).toBeAttached()
  })
})

test.describe('Game View Layout', () => {
  test('should have responsive game layout', async ({ page }) => {
    await page.goto('/?roomId=test-room')

    const layout = page.locator('.game-layout')
    await expect(layout).toBeVisible()

    const main = page.locator('.game-main')
    await expect(main).toBeVisible()

    const sidebar = page.locator('.game-sidebar')
    await expect(sidebar).toBeVisible()
  })

  test('should have site footer in app view', async ({ page }) => {
    await page.goto('/?roomId=test-room')

    const footer = page.locator('#app-view .site__footer')
    await expect(footer).toBeVisible()
    await expect(footer).toContainText('OpenGuessr')
  })
})
