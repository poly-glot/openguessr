import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { CountryPicker } from './index.js'

describe('CountryPicker (combobox)', () => {
  let el

  beforeEach(() => {
    localStorage.clear()
    el = document.createElement('country-picker')
    document.body.appendChild(el)
  })

  afterEach(() => {
    el.remove()
    localStorage.clear()
  })

  // ── Basics ──────────────────────────────────────────────────

  it('is registered as a custom element', () => {
    expect(customElements.get('country-picker')).toBe(CountryPicker)
  })

  it('has correct default property values', () => {
    expect(el.disabled).toBe(false)
    expect(el.hidden).toBe(false)
    expect(el.selectedCountry).toBeNull()
    expect(el._query).toBe('')
    expect(el._open).toBe(false)
  })

  it('renders instructions text when enabled', async () => {
    el.disabled = false
    await el.updateComplete
    const instructions = el.renderRoot.querySelector('[data-cy="picker-instructions"]')
    expect(instructions.textContent).toMatch(/fly the map/i)
  })

  it('renders disabled instructions when disabled', async () => {
    el.disabled = true
    await el.updateComplete
    const instructions = el.renderRoot.querySelector('[data-cy="picker-instructions"]')
    expect(instructions.textContent).toContain('country picker will be enabled')
  })

  // ── Combobox input ──────────────────────────────────────────

  it('renders a combobox input with proper ARIA roles', async () => {
    await el.updateComplete
    const input = el.renderRoot.querySelector('[data-cy="country-search"]')
    expect(input).toBeTruthy()
    expect(input.getAttribute('role')).toBe('combobox')
    expect(input.getAttribute('aria-autocomplete')).toBe('list')
    expect(input.getAttribute('aria-expanded')).toBe('false')
  })

  it('disables search input when disabled', async () => {
    el.disabled = true
    await el.updateComplete
    const input = el.renderRoot.querySelector('[data-cy="country-search"]')
    expect(input.disabled).toBe(true)
  })

  it('does NOT render its own submit button — the map below owns the CTA', async () => {
    await el.updateComplete
    const submit = el.renderRoot.querySelector('[data-cy="submit-guess"]')
    expect(submit).toBeNull()
  })

  // ── Listbox / dropdown ──────────────────────────────────────

  it('opens the listbox on focus', async () => {
    await el.updateComplete
    const input = el.renderRoot.querySelector('[data-cy="country-search"]')
    input.dispatchEvent(new FocusEvent('focus'))
    await el.updateComplete
    const listbox = el.renderRoot.querySelector('[data-cy="picker-listbox"]')
    expect(listbox).toBeTruthy()
    expect(input.getAttribute('aria-expanded')).toBe('true')
  })

  it('does not open on focus when disabled', async () => {
    el.disabled = true
    await el.updateComplete
    const input = el.renderRoot.querySelector('[data-cy="country-search"]')
    input.dispatchEvent(new FocusEvent('focus'))
    await el.updateComplete
    expect(el.renderRoot.querySelector('[data-cy="picker-listbox"]')).toBeNull()
  })

  it('renders countries alphabetically when listbox is open', async () => {
    el._open = true
    await el.updateComplete
    const options = [...el.renderRoot.querySelectorAll('.combobox__option')]
    const names = options.map(o => o.querySelector('.combobox__option-name').textContent)
    const sorted = [...names].sort((a, b) => a.localeCompare(b))
    expect(names).toEqual(sorted)
  })

  it('renders >50 options when listbox is open and unfiltered', async () => {
    el._open = true
    await el.updateComplete
    const options = el.renderRoot.querySelectorAll('.combobox__option')
    expect(options.length).toBeGreaterThan(50)
  })

  it('renders flag svgs that reference the sprite', async () => {
    el._open = true
    await el.updateComplete
    const uses = el.renderRoot.querySelectorAll('.combobox__option svg use')
    expect(uses.length).toBeGreaterThan(0)
    // Initial render (before async sprite injection) uses the external sprite path.
    const href = uses[0].getAttribute('href') || uses[0].getAttributeNS('http://www.w3.org/1999/xlink', 'href')
    expect(href).toMatch(/^(\/assets\/flags-sprite\.svg)?#flag-[a-z]{2}$/)
    expect(href).not.toMatch(/flagcdn|https?:/)
  })

  it('renders the selected flag inline using the same sprite reference', async () => {
    el._pickCountry('JP')
    await el.updateComplete
    const use = el.renderRoot.querySelector('.combobox__field .combobox__flag use')
    const href = use.getAttribute('href')
    expect(href).toMatch(/^(\/assets\/flags-sprite\.svg)?#flag-jp$/)
  })

  // ── Selection ───────────────────────────────────────────────

  it('selects country on option mousedown', async () => {
    el._open = true
    await el.updateComplete
    const fr = el.renderRoot.querySelector('[data-code="FR"]')
    fr.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }))
    await el.updateComplete
    expect(el.selectedCountry).toBe('FR')
    expect(el._open).toBe(false)
  })

  it('does not select when disabled', () => {
    el.disabled = true
    el._pickCountry('US')
    expect(el.selectedCountry).toBeNull()
  })

  it('renders selected flag inside the field', async () => {
    el._pickCountry('FR')
    await el.updateComplete
    const flag = el.renderRoot.querySelector('.combobox__field .combobox__flag')
    expect(flag).toBeTruthy()
    const use = flag.querySelector('use')
    expect(use.getAttribute('href')).toMatch(/#flag-fr$/)
  })

  // ── Keyboard ────────────────────────────────────────────────

  it('ArrowDown moves the highlight', async () => {
    await el.updateComplete
    const input = el.renderRoot.querySelector('[data-cy="country-search"]')
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
    await el.updateComplete
    expect(el._open).toBe(true)
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
    await el.updateComplete
    expect(el._highlight).toBe(1)
  })

  it('ArrowUp clamps at 0', async () => {
    el._open = true
    el._highlight = 0
    await el.updateComplete
    const input = el.renderRoot.querySelector('[data-cy="country-search"]')
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }))
    expect(el._highlight).toBe(0)
  })

  it('Enter on highlighted option picks it', async () => {
    el._open = true
    el._highlight = 0
    await el.updateComplete
    const firstCode = el._visibleOptions()[0].code
    const input = el.renderRoot.querySelector('[data-cy="country-search"]')
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    expect(el.selectedCountry).toBe(firstCode)
  })

  it('Escape closes the listbox', async () => {
    el._open = true
    await el.updateComplete
    const input = el.renderRoot.querySelector('[data-cy="country-search"]')
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(el._open).toBe(false)
  })

  // ── Filtering ───────────────────────────────────────────────

  it('typing filters options by name', async () => {
    el._open = true
    el._query = 'fra'
    await el.updateComplete
    const names = [...el.renderRoot.querySelectorAll('.combobox__option-name')].map(n => n.textContent)
    expect(names.length).toBeGreaterThan(0)
    names.forEach(name => expect(name.toLowerCase()).toContain('fra'))
  })

  it('typing filters by code prefix', async () => {
    el._open = true
    el._query = 'gb'
    await el.updateComplete
    const codes = [...el.renderRoot.querySelectorAll('.combobox__option-code')].map(n => n.textContent)
    expect(codes).toContain('GB')
  })

  it('shows empty state when no matches', async () => {
    el._open = true
    el._query = 'xyzzznot'
    await el.updateComplete
    const empty = el.renderRoot.querySelector('[data-cy="picker-empty"]')
    expect(empty).toBeTruthy()
  })

  it('typing clears any locked selection', async () => {
    el.selectedCountry = 'US'
    await el.updateComplete
    const input = el.renderRoot.querySelector('[data-cy="country-search"]')
    input.value = 'fra'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    expect(el.selectedCountry).toBeNull()
    expect(el._query).toBe('fra')
  })

  // ── Selection events ────────────────────────────────────────

  it('dispatches country-selected when a country is picked', async () => {
    const handler = vi.fn()
    el.addEventListener('country-selected', handler)
    el._pickCountry('FR')
    expect(handler).toHaveBeenCalledTimes(1)
    expect(handler.mock.calls[0][0].detail).toEqual({ code: 'FR', name: 'France' })
    expect(handler.mock.calls[0][0].bubbles).toBe(true)
    expect(handler.mock.calls[0][0].composed).toBe(true)
  })

  it('picking a country saves it to recent (no separate submit step)', async () => {
    el._pickCountry('DE')
    const pinned = JSON.parse(localStorage.getItem('openguessr:pinned-countries'))
    expect(pinned[0]).toBe('DE')
  })

  it('clearing the selection dispatches country-cleared', async () => {
    el._pickCountry('US')
    await el.updateComplete
    const handler = vi.fn()
    el.addEventListener('country-cleared', handler)
    const clear = el.renderRoot.querySelector('[data-cy="picker-clear"]')
    clear.click()
    expect(handler).toHaveBeenCalledTimes(1)
  })

  // ── Recent / pinned ─────────────────────────────────────────

  it('savePinned stores country code in localStorage', () => {
    el.savePinned('FR')
    const pinned = JSON.parse(localStorage.getItem('openguessr:pinned-countries'))
    expect(pinned).toEqual(['FR'])
  })

  it('savePinned keeps max 3 entries', () => {
    el.savePinned('FR')
    el.savePinned('DE')
    el.savePinned('US')
    el.savePinned('GB')
    const pinned = JSON.parse(localStorage.getItem('openguessr:pinned-countries'))
    expect(pinned).toEqual(['GB', 'US', 'DE'])
  })

  it('savePinned moves existing to front', () => {
    el.savePinned('FR')
    el.savePinned('DE')
    el.savePinned('FR')
    const pinned = JSON.parse(localStorage.getItem('openguessr:pinned-countries'))
    expect(pinned[0]).toBe('FR')
    expect(pinned.length).toBe(2)
  })

  it('renders Recent group when pinned countries exist and no query', async () => {
    localStorage.setItem('openguessr:pinned-countries', JSON.stringify(['US', 'FR']))
    el.remove()
    el = document.createElement('country-picker')
    document.body.appendChild(el)
    el._open = true
    await el.updateComplete
    const labels = [...el.renderRoot.querySelectorAll('.combobox__group-label')].map(n => n.textContent)
    expect(labels).toContain('Recent')
    expect(labels).toContain('All countries')
  })

  it('hides Recent group while filtering', async () => {
    localStorage.setItem('openguessr:pinned-countries', JSON.stringify(['US', 'FR']))
    el.remove()
    el = document.createElement('country-picker')
    document.body.appendChild(el)
    el._open = true
    el._query = 'jap'
    await el.updateComplete
    const labels = [...el.renderRoot.querySelectorAll('.combobox__group-label')].map(n => n.textContent)
    expect(labels).not.toContain('Recent')
  })

  // ── Clear / reset ───────────────────────────────────────────

  it('reset clears selection, query, open, highlight', () => {
    el.selectedCountry = 'US'
    el._query = 'us'
    el._open = true
    el._highlight = 5
    el.reset()
    expect(el.selectedCountry).toBeNull()
    expect(el._query).toBe('')
    expect(el._open).toBe(false)
    expect(el._highlight).toBe(0)
  })

  it('clear button resets selection', async () => {
    el._pickCountry('US')
    await el.updateComplete
    const clear = el.renderRoot.querySelector('[data-cy="picker-clear"]')
    clear.click()
    expect(el.selectedCountry).toBeNull()
    expect(el._query).toBe('')
  })

  // ── Outside click ───────────────────────────────────────────

  it('closes the listbox on outside mousedown', async () => {
    el._open = true
    await el.updateComplete
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, composed: true }))
    expect(el._open).toBe(false)
  })

  it('keeps the listbox open on inside mousedown', async () => {
    el._open = true
    await el.updateComplete
    const input = el.renderRoot.querySelector('[data-cy="country-search"]')
    input.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, composed: true }))
    expect(el._open).toBe(true)
  })

  // ── Disabled state ──────────────────────────────────────────

  it('applies disabled class to container when disabled', async () => {
    el.disabled = true
    await el.updateComplete
    const container = el.renderRoot.querySelector('.country-picker')
    expect(container.classList.contains('country-picker--disabled')).toBe(true)
  })
})
