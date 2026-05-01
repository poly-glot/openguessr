import { test, expect } from '@playwright/test'

const SCREENSHOT_DIR = 'test-results/combobox-game-flow'

async function signInAndCreate (page, username) {
  await page.goto('/')
  await page.click('[data-cy="start-game"]')
  await expect(page.locator('.auth-dialog')).toBeVisible({ timeout: 5000 })
  await page.fill('[data-cy="username"]', username)
  await page.click('[data-cy="submit"]')
  await expect(page).toHaveURL(/roomId=/, { timeout: 15000 })
  await expect(page.locator('.auth-dialog')).toBeHidden({ timeout: 5000 })
  return new URL(page.url()).searchParams.get('roomId')
}

async function signInAndJoin (page, username, roomId) {
  await page.goto(`/?roomId=${roomId}`)
  await expect(page.locator('.auth-dialog')).toBeVisible({ timeout: 5000 })
  await page.fill('[data-cy="username"]', username)
  await page.click('[data-cy="submit"]')
  await expect(page.locator('.auth-dialog')).toBeHidden({ timeout: 10000 })
}

test.describe('Combobox-driven guess submission', () => {
  test('picking a country in combobox flies the map to it and the existing Submit Guess CTA submits', async ({ browser }) => {
    test.setTimeout(120000)

    const aliceCtx = await browser.newContext()
    const bobCtx = await browser.newContext()
    const alice = await aliceCtx.newPage()
    const bob = await bobCtx.newPage()

    const roomId = await signInAndCreate(alice, 'AliceCombo')
    expect(roomId).toBeTruthy()

    await signInAndJoin(bob, 'BobCombo', roomId)

    await alice.waitForFunction(() => {
      const view = document.querySelector('game-view')
      return view && Object.keys(view._players || {}).length >= 2
    }, null, { timeout: 15000 })

    // Host starts the game
    await alice.click('[data-cy="start-game-btn"]')

    // Wait for the round to actually be in "playing" state on both sides —
    // otherwise the picker is still disabled and won't accept input.
    await alice.waitForFunction(() => {
      const view = document.querySelector('game-view')
      return view?._gameState?.status === 'playing'
    }, null, { timeout: 15000 })
    await bob.waitForFunction(() => {
      const view = document.querySelector('game-view')
      return view?._gameState?.status === 'playing'
    }, null, { timeout: 15000 })

    // Wait for the country-picker to render in Alice's sidebar and become enabled
    await alice.waitForFunction(() => {
      const view = document.querySelector('game-view')
      const picker = view?.shadowRoot?.querySelector('country-picker')
      return picker && !picker.disabled
    }, null, { timeout: 10000 })
    await alice.waitForFunction(() =>
      !!document.querySelector('game-view')?.shadowRoot?.querySelector('guess-map')
    )

    await alice.screenshot({ path: `${SCREENSHOT_DIR}/01-game-with-combobox.png`, fullPage: false })

    // Capture the dropdown OPEN over the map — verifies the listbox
    // overlays cleanly above leaflet panes and country labels.
    await alice.evaluate(async () => {
      const view = document.querySelector('game-view')
      const picker = view.shadowRoot.querySelector('country-picker')
      const input = picker.renderRoot.querySelector('[data-cy="country-search"]')
      input.focus()
      input.value = 'a'
      input.dispatchEvent(new Event('input', { bubbles: true }))
      await picker.updateComplete
    })
    // Let the listbox lay out and the leaflet map render its tooltips
    await alice.waitForFunction(() => {
      const view = document.querySelector('game-view')
      const picker = view?.shadowRoot?.querySelector('country-picker')
      return !!picker?.renderRoot?.querySelector('[data-cy="picker-listbox"]')
    })
    await alice.waitForTimeout(800)

    // Dropdown must paint above the map at every point inside its rect —
    // including points that overlap leaflet polygon paths and labels.
    const overlapTopmost = await alice.evaluate(() => {
      const view = document.querySelector('game-view')
      const map = view.shadowRoot.querySelector('guess-map')
      const picker = view.shadowRoot.querySelector('country-picker')
      const listbox = picker.renderRoot.querySelector('[data-cy="picker-listbox"]')
      const lr = listbox.getBoundingClientRect()
      const mr = map.getBoundingClientRect()
      // Sample only points that lie inside BOTH the listbox and the map
      // bounding rect — those are the points where the dropdown must
      // visually cover the map.
      const left = Math.max(lr.left, mr.left) + 10
      const right = Math.min(lr.right, mr.right) - 10
      const top = Math.max(lr.top, mr.top) + 5
      const bottom = Math.min(lr.bottom, mr.bottom) - 10
      const samples = [
        [left + 5, top + 5],
        [(left + right) / 2, (top + bottom) / 2],
        [right - 5, bottom - 5]
      ]
      return samples.map(([x, y]) => ({ x, y, tag: view.shadowRoot.elementsFromPoint(x, y)[0]?.tagName }))
    })
    for (const probe of overlapTopmost) {
      const within = probe.x >= 0 && probe.x < 1280 && probe.y >= 0 && probe.y < 720
      if (!within) continue
      expect(probe.tag, `at (${probe.x},${probe.y})`).toBe('COUNTRY-PICKER')
    }

    await alice.screenshot({ path: `${SCREENSHOT_DIR}/01b-dropdown-over-map.png`, fullPage: false })

    // Drive the combobox in the game-view shadow tree (twice nested):
    //   game-view → country-picker → input
    const pickedCountry = await alice.evaluate(async () => {
      const view = document.querySelector('game-view')
      const picker = view.shadowRoot.querySelector('country-picker')
      const input = picker.renderRoot.querySelector('[data-cy="country-search"]')
      input.focus()
      input.value = 'fra'
      input.dispatchEvent(new Event('input', { bubbles: true }))
      // Lit needs a tick to render the filtered listbox
      await picker.updateComplete
      const opt = picker.renderRoot.querySelector('.combobox__option')
      opt.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }))
      await picker.updateComplete
      return picker.selectedCountry
    })
    expect(pickedCountry).toBe('FR')

    // The map should now have a marker placed at France's centroid —
    // i.e. selectedLat/selectedLng are set on the guess-map.
    await alice.waitForFunction(() => {
      const view = document.querySelector('game-view')
      const m = view?.shadowRoot?.querySelector('guess-map')
      return m && m.selectedLat != null && m.selectedLng != null
    }, null, { timeout: 5000 })

    const pinAfterPick = await alice.evaluate(() => {
      const view = document.querySelector('game-view')
      const m = view.shadowRoot.querySelector('guess-map')
      return { lat: m.selectedLat, lng: m.selectedLng }
    })
    // France centroid is roughly (46, 2) — anywhere inside the bounding box
    // is acceptable since flyToBounds picks the center of the polygon.
    expect(pinAfterPick.lat).toBeGreaterThan(40)
    expect(pinAfterPick.lat).toBeLessThan(52)
    expect(pinAfterPick.lng).toBeGreaterThan(-6)
    expect(pinAfterPick.lng).toBeLessThan(10)

    await alice.screenshot({ path: `${SCREENSHOT_DIR}/02-map-flew-to-france.png`, fullPage: false })

    // Country-picker has no submit button of its own (single-CTA rule)
    const pickerSubmit = await alice.evaluate(() => {
      const view = document.querySelector('game-view')
      const picker = view.shadowRoot.querySelector('country-picker')
      return !!picker.renderRoot.querySelector('[data-cy="submit-guess"]')
    })
    expect(pickerSubmit).toBe(false)

    // The single Submit Guess CTA lives under the map. Click it and verify
    // the guess was sent.
    await alice.evaluate(() => {
      const view = document.querySelector('game-view')
      const m = view.shadowRoot.querySelector('guess-map')
      const btn = m.renderRoot.querySelector('[data-cy="submit-guess"]')
      btn.click()
    })

    await alice.waitForFunction(() => {
      const view = document.querySelector('game-view')
      return view._hasGuessed === true
    }, null, { timeout: 10000 })

    // Bob also submits via the map directly so the round can finish
    await bob.waitForFunction(() =>
      !!document.querySelector('game-view')?.shadowRoot?.querySelector('guess-map')
    )
    await bob.evaluate(() => {
      const view = document.querySelector('game-view')
      const m = view.shadowRoot.querySelector('guess-map')
      m.selectedLat = 40
      m.selectedLng = -3
      m.dispatchEvent(new CustomEvent('guess', { detail: { lat: 40, lng: -3 }, bubbles: true, composed: true }))
    })

    await alice.waitForFunction(() => {
      const view = document.querySelector('game-view')
      return view._scoreResult && typeof view._scoreResult.score === 'number'
    }, null, { timeout: 30000 })

    await alice.screenshot({ path: `${SCREENSHOT_DIR}/03-revealed.png`, fullPage: false })

    await aliceCtx.close()
    await bobCtx.close()
  })
})
