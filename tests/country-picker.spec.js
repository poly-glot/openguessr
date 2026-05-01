import { test, expect } from '@playwright/test'

const SCREENSHOT_DIR = 'test-results/country-picker'

// The preview page mounts <country-picker> in isolation so we can drive the
// combobox without going through the full multiplayer flow.
const PREVIEW_URL = '/preview-country-picker.html'

test.describe('Country picker combobox', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(PREVIEW_URL)
    await page.waitForFunction(() => !!customElements.get('country-picker'))
  })

  // Helper that walks into the shadow DOM
  const inShadow = '.country-picker'

  test('renders combobox with input and no internal submit button', async ({ page }) => {
    const picker = page.locator('country-picker')
    await expect(picker.locator(inShadow)).toBeVisible()

    const input = picker.locator('[data-cy="country-search"]')
    await expect(input).toBeVisible()
    await expect(input).toHaveAttribute('role', 'combobox')

    // The picker does NOT own a submit button — the map below the picker
    // owns the single Submit Guess CTA.
    await expect(picker.locator('[data-cy="submit-guess"]')).toHaveCount(0)
  })

  test('typing filters results and selecting picks the country', async ({ page }) => {
    const picker = page.locator('country-picker')
    const input = picker.locator('[data-cy="country-search"]')

    await input.click()
    await input.fill('jap')

    // Listbox shows filtered options — only countries containing "jap"
    const listbox = picker.locator('[data-cy="picker-listbox"]')
    await expect(listbox).toBeVisible()

    const options = picker.locator('.combobox__option')
    await expect(options).toHaveCount(1)
    await expect(options.first()).toContainText('Japan')

    // Click the option (mousedown handler picks it) — picking dispatches
    // country-selected directly; the preview page reflects that.
    await options.first().dispatchEvent('mousedown')

    await expect(input).toHaveValue('Japan')
    await expect(page.locator('[data-cy="status"]')).toHaveText('Selected: JP (Japan)')
  })

  test('keyboard nav: ArrowDown + Enter selects the first match', async ({ page }) => {
    const picker = page.locator('country-picker')
    const input = picker.locator('[data-cy="country-search"]')

    await input.click()
    await input.fill('fra')
    await input.press('ArrowDown')
    await input.press('Enter')

    await expect(input).toHaveValue('France')
  })

  test('Escape closes the listbox without picking', async ({ page }) => {
    const picker = page.locator('country-picker')
    const input = picker.locator('[data-cy="country-search"]')

    await input.click()
    await expect(picker.locator('[data-cy="picker-listbox"]')).toBeVisible()
    await input.press('Escape')
    await expect(picker.locator('[data-cy="picker-listbox"]')).toBeHidden()
  })

  test('options are rendered in alphabetical order', async ({ page }) => {
    const picker = page.locator('country-picker')
    const input = picker.locator('[data-cy="country-search"]')

    await input.click()

    const names = await picker.locator('.combobox__option-name').allTextContents()
    expect(names.length).toBeGreaterThan(50)
    const sorted = [...names].sort((a, b) => a.localeCompare(b))
    expect(names).toEqual(sorted)
  })

  test('flag SVG references the bundled sprite (not flagcdn)', async ({ page }) => {
    const picker = page.locator('country-picker')
    const input = picker.locator('[data-cy="country-search"]')
    await input.click()

    // Once the sprite has been fetched and injected into the shadow root,
    // <use> references collapse to a local "#flag-xx" hash. Either form
    // is acceptable; what matters is that no href hits an external CDN.
    const hrefs = await picker.locator('.combobox__option svg use').evaluateAll(
      els => els.map(el => el.getAttribute('href'))
    )
    expect(hrefs.length).toBeGreaterThan(0)
    for (const href of hrefs) {
      expect(href).toMatch(/^(\/assets\/flags-sprite\.svg)?#flag-[a-z]{2}$/)
      expect(href).not.toMatch(/flagcdn|https?:/)
    }

    // Sprite is bundled with the app and reachable from the dev server
    const resp = await page.request.get('/assets/flags-sprite.svg')
    expect(resp.status()).toBe(200)
    expect(resp.headers()['content-type']).toContain('svg')
  })

  test('captures a screenshot of the open combobox', async ({ page }) => {
    const picker = page.locator('country-picker')
    const input = picker.locator('[data-cy="country-search"]')

    await input.click()
    await input.fill('un')
    // Settle one render tick + ensure flag sprite has fetched
    await page.waitForTimeout(300)

    await page.screenshot({ path: `${SCREENSHOT_DIR}/01-combobox-open.png`, fullPage: false })

    // Pick one and capture the locked-in state too
    await picker.locator('[data-cy="option-GB"]').dispatchEvent('mousedown')
    await page.waitForTimeout(150)
    await page.screenshot({ path: `${SCREENSHOT_DIR}/02-combobox-selected.png`, fullPage: false })
  })

  test('recent group appears after picking once', async ({ page, context }) => {
    await context.clearCookies()
    await page.evaluate(() => localStorage.clear())
    await page.reload()
    await page.waitForFunction(() => !!customElements.get('country-picker'))

    const picker = page.locator('country-picker')
    const input = picker.locator('[data-cy="country-search"]')

    await input.click()
    await input.fill('ger')
    await picker.locator('.combobox__option').first().dispatchEvent('mousedown')

    // Reopen and check Recent group exists — picking alone is enough now.
    await picker.locator('[data-cy="picker-clear"]').click()
    await page.waitForTimeout(100)

    const labels = await picker.locator('.combobox__group-label').allTextContents()
    expect(labels).toContain('Recent')
    expect(labels).toContain('All countries')
  })
})
