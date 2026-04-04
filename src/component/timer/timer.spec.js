import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { RoundTimer } from './index.js'

describe('RoundTimer', () => {
  let el

  beforeEach(() => {
    el = document.createElement('round-timer')
    document.body.appendChild(el)
  })

  afterEach(() => {
    el.remove()
  })

  it('is registered as a custom element', () => {
    expect(customElements.get('round-timer')).toBe(RoundTimer)
  })

  it('has correct default property values', () => {
    expect(el.startedAt).toBe(0)
    expect(el.duration).toBe(30)
    expect(el._timeRemaining).toBe(30)
    expect(el._done).toBe(false)
  })

  it('renders timer display with formatted time', async () => {
    el.duration = 90
    el._timeRemaining = 90
    await el.updateComplete
    const timerSpan = el.renderRoot.querySelector('[data-cy="timer"]')
    expect(timerSpan.textContent).toBe('01:30')
  })

  it('renders slot for round label', async () => {
    await el.updateComplete
    const slot = el.renderRoot.querySelector('slot')
    expect(slot).toBeTruthy()
  })

  it('shows DONE when setDone() is called', async () => {
    el.setDone()
    await el.updateComplete
    const timerSpan = el.renderRoot.querySelector('[data-cy="timer"]')
    expect(timerSpan.textContent).toBe('DONE')
    expect(el._done).toBe(true)
  })

  it('applies urgent class when time remaining <= 5 and > 0', async () => {
    el._timeRemaining = 4
    el._done = false
    await el.updateComplete
    const timerSpan = el.renderRoot.querySelector('[data-cy="timer"]')
    expect(timerSpan.classList.contains('round-info__timer--urgent')).toBe(true)
  })

  it('does not apply urgent class when time is 0', async () => {
    el._timeRemaining = 0
    el._done = false
    await el.updateComplete
    const timerSpan = el.renderRoot.querySelector('[data-cy="timer"]')
    expect(timerSpan.classList.contains('round-info__timer--urgent')).toBe(false)
  })

  it('does not apply urgent class when time > 5', async () => {
    el._timeRemaining = 10
    await el.updateComplete
    const timerSpan = el.renderRoot.querySelector('[data-cy="timer"]')
    expect(timerSpan.classList.contains('round-info__timer--urgent')).toBe(false)
  })

  it('starts ticking when startedAt is set', async () => {
    vi.useFakeTimers()
    el.startedAt = Date.now()
    el.duration = 30
    await el.updateComplete

    expect(el._interval).not.toBeNull()

    vi.advanceTimersByTime(500)
    expect(el._timeRemaining).toBeLessThanOrEqual(30)

    vi.useRealTimers()
    el._stopTicking()
  })

  it('does not start ticking when startedAt is 0', async () => {
    el.startedAt = 0
    await el.updateComplete
    expect(el._interval).toBeNull()
  })

  it('dispatches timer-expired when time runs out', async () => {
    const handler = vi.fn()
    el.addEventListener('timer-expired', handler)

    // Set startedAt to well in the past so timer expires on first tick
    el.duration = 30
    el.startedAt = Date.now() - 31000
    await el.updateComplete

    // Wait for tick interval to fire
    await new Promise(resolve => setTimeout(resolve, 350))

    expect(handler).toHaveBeenCalled()
    expect(handler.mock.calls[0][0].bubbles).toBe(true)
    expect(handler.mock.calls[0][0].composed).toBe(true)
  })

  it('stop() clears the interval', async () => {
    vi.useFakeTimers()
    el.startedAt = Date.now()
    el.duration = 30
    await el.updateComplete

    expect(el._interval).not.toBeNull()
    el.stop()
    expect(el._interval).toBeNull()

    vi.useRealTimers()
  })

  it('cleans up interval on disconnectedCallback', async () => {
    vi.useFakeTimers()
    el.startedAt = Date.now()
    el.duration = 30
    await el.updateComplete

    expect(el._interval).not.toBeNull()
    el.remove()
    expect(el._interval).toBeNull()

    vi.useRealTimers()
  })

  it('resets done and restarts on startedAt change', async () => {
    vi.useFakeTimers()
    el.setDone()
    expect(el._done).toBe(true)

    el.startedAt = Date.now()
    el.duration = 30
    await el.updateComplete

    expect(el._done).toBe(false)
    expect(el._interval).not.toBeNull()

    vi.useRealTimers()
    el._stopTicking()
  })

  it('recalculates time remaining on each tick', async () => {
    vi.useFakeTimers()
    const now = Date.now()
    el.startedAt = now
    el.duration = 10
    await el.updateComplete

    vi.advanceTimersByTime(5000)
    expect(el._timeRemaining).toBeLessThanOrEqual(5)
    expect(el._timeRemaining).toBeGreaterThanOrEqual(0)

    vi.useRealTimers()
    el._stopTicking()
  })

  it('clamps time remaining to 0 minimum', async () => {
    vi.useFakeTimers()
    el.startedAt = Date.now() - 50000
    el.duration = 10
    await el.updateComplete

    expect(el._timeRemaining).toBe(0)

    vi.useRealTimers()
  })
})
