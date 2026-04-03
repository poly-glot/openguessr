import { test, expect } from '@playwright/test'

test.describe('Landing Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('should show landing page by default', async ({ page }) => {
    const landing = page.locator('#landing-page')
    await expect(landing).toBeVisible()

    const app = page.locator('#app-view')
    await expect(app).toBeHidden()
  })

  test('should have hero section with heading and CTA', async ({ page }) => {
    const heading = page.locator('.hero-text h1')
    await expect(heading).toContainText('Guess the country')

    const cta = page.locator('[data-cy="start-game"]')
    await expect(cta).toBeVisible()
    await expect(cta).toContainText('Start a game')
  })

  test('should have all landing sections', async ({ page }) => {
    await expect(page.locator('.features-section')).toBeVisible()
    await expect(page.locator('.concept-section')).toBeVisible()
    await expect(page.locator('.cta-section')).toBeVisible()
    await expect(page.locator('.landing-footer')).toBeVisible()
  })

  test('should have 6 feature items', async ({ page }) => {
    const items = page.locator('.feature-item')
    await expect(items).toHaveCount(6)
  })

  test('should have 4 how-it-works steps', async ({ page }) => {
    const steps = page.locator('.concept-steps li')
    await expect(steps).toHaveCount(4)
  })

  test('CTA click should hide landing and show auth dialog', async ({ page }) => {
    await page.click('[data-cy="start-game"]')

    const landing = page.locator('#landing-page')
    await expect(landing).toBeHidden()

    const app = page.locator('#app-view')
    await expect(app).toBeVisible()
  })

  test('brand link should return to landing from app view', async ({ page }) => {
    await page.click('[data-cy="start-game"]')
    await expect(page.locator('#app-view')).toBeVisible()

    await page.click('.site__brand a')
    await expect(page.locator('#landing-page')).toBeVisible()
    await expect(page.locator('#app-view')).toBeHidden()
  })

  test('should have valid GitHub links', async ({ page }) => {
    const sourceLink = page.locator('.site__header-nav a')
    await expect(sourceLink).toHaveAttribute('href', /github\.com\/nicholasgasior/)
  })

  test('footer Start Game link should trigger game flow', async ({ page }) => {
    await page.click('.footer-links [data-action="start-game"]')
    await expect(page.locator('#landing-page')).toBeHidden()
    await expect(page.locator('#app-view')).toBeVisible()
  })
})
