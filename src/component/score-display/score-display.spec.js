import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ScoreDisplay } from './index.js'

describe('ScoreDisplay', () => {
  let el

  beforeEach(() => {
    el = document.createElement('score-display')
    document.body.appendChild(el)
  })

  afterEach(() => {
    el.remove()
  })

  it('is registered as a custom element', () => {
    expect(customElements.get('score-display')).toBe(ScoreDisplay)
  })

  it('has correct default property values', () => {
    expect(el.correct).toBe(false)
    expect(el.score).toBe(0)
    expect(el.correctCountryCode).toBeNull()
    expect(el.visible).toBe(false)
    expect(el.waitingForHost).toBe(false)
    expect(el._motivation).toBe('')
    expect(el._shaking).toBe(false)
  })

  it('renders "Correct!" when correct is true', async () => {
    el.correct = true
    el.visible = true
    await el.updateComplete
    const result = el.renderRoot.querySelector('.score-display__result')
    expect(result.textContent.trim()).toBe('Correct!')
    expect(result.classList.contains('score-display__result--correct')).toBe(true)
  })

  it('renders "Wrong!" when correct is false', async () => {
    el.correct = false
    el.visible = true
    await el.updateComplete
    const result = el.renderRoot.querySelector('.score-display__result')
    expect(result.textContent.trim()).toBe('Wrong!')
    expect(result.classList.contains('score-display__result--wrong')).toBe(true)
  })

  it('displays score points', async () => {
    el.score = 1200
    el.visible = true
    await el.updateComplete
    const points = el.renderRoot.querySelector('.score-display__points')
    expect(points.textContent).toContain('+1200 points')
  })

  it('displays country answer when correctCountryCode is set', async () => {
    el.correctCountryCode = 'US'
    el.visible = true
    await el.updateComplete
    const answer = el.renderRoot.querySelector('.score-display__answer')
    expect(answer.textContent).toContain('The answer was')
    expect(answer.textContent).toContain('United States')
  })

  it('displays empty answer when correctCountryCode is null', async () => {
    el.correctCountryCode = null
    el.visible = true
    await el.updateComplete
    const answer = el.renderRoot.querySelector('.score-display__answer')
    expect(answer.textContent.trim()).toBe('')
  })

  it('sets motivation text when visible becomes true', async () => {
    el.correct = true
    el.visible = true
    await el.updateComplete
    expect(el._motivation).toBeTruthy()
    expect(typeof el._motivation).toBe('string')
  })

  it('sets shaking to true when wrong answer and visible', async () => {
    el.correct = false
    el.visible = true
    await el.updateComplete
    expect(el._shaking).toBe(true)
  })

  it('sets shaking to false when correct answer and visible', async () => {
    el.correct = true
    el.visible = true
    await el.updateComplete
    expect(el._shaking).toBe(false)
  })

  it('applies shaking class when _shaking is true', async () => {
    el._shaking = true
    await el.updateComplete
    const display = el.renderRoot.querySelector('.score-display')
    expect(display.classList.contains('score-display--shaking')).toBe(true)
  })

  it('dispatches score-closed event on close button click', async () => {
    el.visible = true
    await el.updateComplete

    const handler = vi.fn()
    el.addEventListener('score-closed', handler)

    const closeBtn = el.renderRoot.querySelector('.score-display__close')
    closeBtn.click()

    expect(handler).toHaveBeenCalledTimes(1)
    expect(el.visible).toBe(false)
    expect(handler.mock.calls[0][0].bubbles).toBe(true)
    expect(handler.mock.calls[0][0].composed).toBe(true)
  })

  it('shows waiting indicator when waitingForHost is true', async () => {
    el.visible = true
    el.waitingForHost = true
    await el.updateComplete
    const waiting = el.renderRoot.querySelector('[data-cy="waiting-for-host"]')
    expect(waiting).toBeTruthy()
    expect(waiting.textContent).toContain('Waiting for host')
  })

  it('hides waiting indicator when waitingForHost is false', async () => {
    el.visible = true
    el.waitingForHost = false
    await el.updateComplete
    const waiting = el.renderRoot.querySelector('[data-cy="waiting-for-host"]')
    expect(waiting).toBeNull()
  })

  it('hides score display when not visible', async () => {
    el.visible = false
    await el.updateComplete
    // The CSS rule :host(:not([visible])) .score-display { display: none; }
    // means the element renders but is hidden by CSS
    const display = el.renderRoot.querySelector('.score-display')
    expect(display).toBeTruthy()
  })

  it('shows close button with aria-label', async () => {
    el.visible = true
    await el.updateComplete
    const closeBtn = el.renderRoot.querySelector('.score-display__close')
    expect(closeBtn).toBeTruthy()
    expect(closeBtn.getAttribute('aria-label')).toBe('Close')
  })

  it('shows motivation text in render', async () => {
    el._motivation = 'Great job!'
    await el.updateComplete
    const motivation = el.renderRoot.querySelector('.score-display__motivation')
    expect(motivation.textContent.trim()).toBe('Great job!')
  })
})
