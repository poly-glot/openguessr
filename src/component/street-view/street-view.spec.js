import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { StreetViewPanel } from './index.js'

describe('StreetViewPanel', () => {
  let el

  beforeEach(() => {
    el = document.createElement('street-view-panel')
    document.body.appendChild(el)
  })

  afterEach(() => {
    el.remove()
  })

  it('is registered as a custom element', () => {
    expect(customElements.get('street-view-panel')).toBe(StreetViewPanel)
  })

  it('has correct default property values', () => {
    expect(el.lat).toBeNull()
    expect(el.lng).toBeNull()
    expect(el.status).toBe('loading')
    expect(el.playerCount).toBe(0)
    expect(el.playerNames).toBe('')
  })

  // Loading state
  it('renders loading state by default', async () => {
    await el.updateComplete
    const placeholder = el.renderRoot.querySelector('.street-view__placeholder')
    expect(placeholder).toBeTruthy()
    expect(placeholder.textContent).toContain('Waiting for game to start')
  })

  it('renders loading state when lat/lng are null', async () => {
    el.status = 'playing'
    el.lat = null
    el.lng = null
    await el.updateComplete
    const placeholder = el.renderRoot.querySelector('.street-view__placeholder')
    expect(placeholder).toBeTruthy()
  })

  // Lobby state
  it('renders lobby state with player count', async () => {
    el.status = 'lobby'
    el.playerCount = 3
    el.playerNames = 'Alice, Bob, Charlie'
    await el.updateComplete

    const lobbyInfo = el.renderRoot.querySelector('[data-cy="lobby-info"]')
    expect(lobbyInfo).toBeTruthy()

    const count = el.renderRoot.querySelector('.lobby-info__count')
    expect(count.textContent).toContain('3 players in lobby')
  })

  it('renders singular "player" for 1 player in lobby', async () => {
    el.status = 'lobby'
    el.playerCount = 1
    await el.updateComplete

    const count = el.renderRoot.querySelector('.lobby-info__count')
    expect(count.textContent).toContain('1 player in lobby')
    expect(count.textContent).not.toContain('players')
  })

  it('renders player names in lobby', async () => {
    el.status = 'lobby'
    el.playerNames = 'Alice, Bob'
    await el.updateComplete

    const names = el.renderRoot.querySelector('.lobby-info__names')
    expect(names.textContent).toBe('Alice, Bob')
  })

  // Street View state
  it('renders panorama container when lat/lng are set and status is playing', async () => {
    el.status = 'playing'
    el.lat = 48.8566
    el.lng = 2.3522
    await el.updateComplete

    const panorama = el.renderRoot.querySelector('[data-cy="street-view-panorama"]')
    expect(panorama).toBeTruthy()
    expect(panorama.classList.contains('street-view__panorama')).toBe(true)
  })

  // Game over state
  it('renders game over state with slot', async () => {
    el.status = 'gameover'
    await el.updateComplete

    const slot = el.renderRoot.querySelector('slot[name="gameover"]')
    expect(slot).toBeTruthy()
  })

  // Effects
  it('showConfetti creates canvas element', async () => {
    el.status = 'playing'
    el.lat = 10
    el.lng = 20
    await el.updateComplete

    // Mock requestAnimationFrame
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(cb => {
      // Don't actually run the animation
      return 1
    })

    el.showConfetti()
    const canvas = el.renderRoot.querySelector('.confetti-canvas')
    expect(canvas).toBeTruthy()

    window.requestAnimationFrame.mockRestore()
  })

  it('showConfetti does nothing when no container', async () => {
    // Don't render anything (status defaults to 'loading' with no lat/lng)
    el.lat = null
    el.lng = null
    el.status = 'loading'
    await el.updateComplete

    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 1)
    el.showConfetti()
    // Should not throw
    window.requestAnimationFrame.mockRestore()
  })

  it('showWrongEffect creates wrong-flash element', async () => {
    el.status = 'playing'
    el.lat = 10
    el.lng = 20
    await el.updateComplete

    el.showWrongEffect()
    const flash = el.renderRoot.querySelector('.wrong-flash')
    expect(flash).toBeTruthy()
  })

  it('showWrongEffect does nothing when no container', async () => {
    el.lat = null
    el.lng = null
    el.status = 'loading'
    await el.updateComplete
    el.showWrongEffect()
    // Should not throw
  })

  it('clearEffects removes confetti and wrong-flash elements', async () => {
    el.status = 'playing'
    el.lat = 10
    el.lng = 20
    await el.updateComplete

    // Add confetti canvas and wrong-flash
    const container = el.renderRoot.querySelector('.street-view')
    const canvas = document.createElement('canvas')
    canvas.className = 'confetti-canvas'
    container.appendChild(canvas)
    const flash = document.createElement('div')
    flash.className = 'wrong-flash'
    container.appendChild(flash)

    el.clearEffects()
    expect(el.renderRoot.querySelector('.confetti-canvas')).toBeNull()
    expect(el.renderRoot.querySelector('.wrong-flash')).toBeNull()
  })

  it('clearEffects does nothing when no container', async () => {
    el.lat = null
    el.lng = null
    el.status = 'loading'
    await el.updateComplete
    el.clearEffects()
    // Should not throw
  })

  it('renders slot in all states', async () => {
    // Loading state
    await el.updateComplete
    let slot = el.renderRoot.querySelector('slot:not([name])')
    expect(slot).toBeTruthy()

    // Lobby state
    el.status = 'lobby'
    await el.updateComplete
    slot = el.renderRoot.querySelector('slot:not([name])')
    expect(slot).toBeTruthy()

    // Playing state
    el.status = 'playing'
    el.lat = 10
    el.lng = 20
    await el.updateComplete
    slot = el.renderRoot.querySelector('slot:not([name])')
    expect(slot).toBeTruthy()
  })
})
