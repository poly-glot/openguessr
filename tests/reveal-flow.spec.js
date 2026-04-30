import { test, expect } from '@playwright/test'

const SCREENSHOT_DIR = 'test-results/reveal-flow'

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

async function dispatchGuess (page, lat, lng) {
  await page.evaluate(({ lat, lng }) => {
    const view = document.querySelector('game-view')
    const guessMap = view.shadowRoot.querySelector('guess-map')
    guessMap.selectedLat = lat
    guessMap.selectedLng = lng
    guessMap.dispatchEvent(new CustomEvent('guess', {
      detail: { lat, lng },
      bubbles: true,
      composed: true
    }))
  }, { lat, lng })
}

async function gameViewState (page, key) {
  return page.evaluate((k) => {
    const view = document.querySelector('game-view')
    return view ? view[k] : undefined
  }, key)
}

async function waitForGameViewState (page, key, predicate, timeout = 10000) {
  await page.waitForFunction(({ k, src }) => {
    const view = document.querySelector('game-view')
    if (!view) return false
    // eslint-disable-next-line no-new-func
    const fn = new Function('v', `return (${src})(v)`)
    return fn(view[k])
  }, { k: key, src: predicate.toString() }, { timeout })
}

test.describe('Reveal flow', () => {
  test('reveal waits for all players or 30s timer; sidebar is wide enough for country labels', async ({ browser }) => {
    test.setTimeout(120000)

    const aliceCtx = await browser.newContext()
    const bobCtx = await browser.newContext()
    const alice = await aliceCtx.newPage()
    const bob = await bobCtx.newPage()

    // 1. Alice creates a game
    const roomId = await signInAndCreate(alice, 'Alice')
    expect(roomId).toBeTruthy()

    // 2. Bob joins
    await signInAndJoin(bob, 'Bob', roomId)

    // Wait for both players to appear in Alice's player list
    await alice.waitForFunction(() => {
      const view = document.querySelector('game-view')
      return view && Object.keys(view._players || {}).length >= 2
    }, null, { timeout: 15000 })

    // Screenshot: lobby with widened sidebar
    await alice.screenshot({ path: `${SCREENSHOT_DIR}/01-lobby-alice.png`, fullPage: false })

    // 3. Alice (host) starts the game
    await alice.click('[data-cy="start-game-btn"]')
    await waitForGameViewState(alice, '_gameState', s => s && s.status === 'playing')
    await waitForGameViewState(bob, '_gameState', s => s && s.status === 'playing')

    // After playing-state arrives, give Lit a tick to render the guess-map
    await alice.waitForFunction(() =>
      !!document.querySelector('game-view')?.shadowRoot?.querySelector('guess-map')
    )
    await bob.waitForFunction(() =>
      !!document.querySelector('game-view')?.shadowRoot?.querySelector('guess-map')
    )

    // Screenshot: in-round, sidebar with widened map zoomed enough for labels
    await alice.screenshot({ path: `${SCREENSHOT_DIR}/02-round-start-alice.png`, fullPage: false })

    // 4. Alice guesses; the result-map must NOT appear yet
    await dispatchGuess(alice, 51.5, -0.1)
    await waitForGameViewState(alice, '_hasGuessed', v => v === true)

    // Verify Alice sees the round-wait overlay, NOT the result-map
    const roundWaitVisible = await alice.evaluate(() => {
      const view = document.querySelector('game-view')
      return !!view.shadowRoot.querySelector('[data-cy="round-wait"]')
    })
    expect(roundWaitVisible).toBe(true)

    const aliceResultMapEarly = await alice.evaluate(() => {
      const view = document.querySelector('game-view')
      return !!view.shadowRoot.querySelector('result-map')
    })
    expect(aliceResultMapEarly).toBe(false)

    // Screenshot: Alice waiting after submitting; Bob still picking
    await alice.screenshot({ path: `${SCREENSHOT_DIR}/03-alice-waiting.png`, fullPage: false })
    await bob.screenshot({ path: `${SCREENSHOT_DIR}/04-bob-still-guessing.png`, fullPage: false })

    // Bob still in playing state; round must NOT be revealed yet on either page
    const bobRevealedMid = await gameViewState(bob, '_scoreResult')
    expect(bobRevealedMid).toBeNull()
    const aliceRevealedMid = await gameViewState(alice, '_scoreResult')
    expect(aliceRevealedMid).toBeNull()

    // 5. Bob guesses → all submitted → reveal flips
    await dispatchGuess(bob, 40, -3)

    // Both pages must now see the result-map (revealed via all-submitted)
    await waitForGameViewState(alice, '_scoreResult', v => v && typeof v.score === 'number')
    await waitForGameViewState(bob, '_scoreResult', v => v && typeof v.score === 'number')

    await alice.waitForFunction(() =>
      !!document.querySelector('game-view')?.shadowRoot?.querySelector('result-map')
    )

    // Screenshot: result-map visible to both
    await alice.screenshot({ path: `${SCREENSHOT_DIR}/05-revealed-alice.png`, fullPage: false })
    await bob.screenshot({ path: `${SCREENSHOT_DIR}/06-revealed-bob.png`, fullPage: false })

    // Sidebar width sanity-check (>= 480px on the desktop viewport)
    const sidebarWidth = await alice.evaluate(() => {
      const view = document.querySelector('game-view')
      const aside = view.shadowRoot.querySelector('.game-sidebar')
      return aside ? aside.getBoundingClientRect().width : 0
    })
    expect(sidebarWidth).toBeGreaterThanOrEqual(480)

    await aliceCtx.close()
    await bobCtx.close()
  })

  test('reveal happens via 60s timer when nobody guesses', async ({ browser }) => {
    test.setTimeout(150000)

    const aliceCtx = await browser.newContext()
    const bobCtx = await browser.newContext()
    const alice = await aliceCtx.newPage()
    const bob = await bobCtx.newPage()

    const roomId = await signInAndCreate(alice, 'AliceTimer')
    await signInAndJoin(bob, 'BobTimer', roomId)

    await alice.waitForFunction(() => {
      const view = document.querySelector('game-view')
      return view && Object.keys(view._players || {}).length >= 2
    }, null, { timeout: 15000 })

    await alice.click('[data-cy="start-game-btn"]')
    await waitForGameViewState(alice, '_gameState', s => s && s.status === 'playing')

    // Neither player guesses. Wait for timer expiry (60s server-side).
    // Client `_onTimerExpired` calls revealRound; server verifies elapsed >= 60s.
    await waitForGameViewState(
      alice,
      '_scoreResult',
      v => v && typeof v.score === 'number',
      80000
    )

    await alice.screenshot({ path: `${SCREENSHOT_DIR}/07-timer-revealed.png`, fullPage: false })

    await aliceCtx.close()
    await bobCtx.close()
  })
})
