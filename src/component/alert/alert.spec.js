import { describe, it, expect, beforeEach } from 'vitest'
import { Alert } from './alert.js'

describe('Alert', () => {
  let alert

  beforeEach(() => {
    alert = new Alert()
  })

  it('init() caches the alert element from the DOM', () => {
    // The js-alert element exists in index.html which is loaded by vitest.setup.js
    alert.init()
    expect(alert._elem).toBeTruthy()
    expect(alert._elem.id).toBe('js-alert')
  })

  it('announce() sets textContent on alert element', () => {
    alert.init()
    alert.announce('Hello world')
    expect(alert._elem.textContent).toBe('Hello world')
  })

  it('announce() does nothing when _elem is not set', () => {
    const alertNoInit = new Alert()
    // Should not throw
    alertNoInit.announce('test')
  })

  it('announce() queues subsequent messages behind the first', () => {
    alert.init()
    alert.announce('First')
    alert.announce('Second')
    expect(alert._elem.textContent).toBe('First')
    expect(alert._queue.length).toBe(2)
    expect(alert._elem.dataset.count).toBe('2')
  })

  it('init() sets _elem to null when element is missing', () => {
    // Temporarily remove the element
    const existing = document.getElementById('js-alert')
    const parent = existing.parentNode
    existing.remove()

    alert.init()
    expect(alert._elem).toBeNull()

    // Restore
    parent.appendChild(existing)
  })
})
