import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { CountryPicker } from './index.js'

describe('CountryPicker', () => {
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

  it('is registered as a custom element', () => {
    expect(customElements.get('country-picker')).toBe(CountryPicker)
  })

  it('has correct default property values', () => {
    expect(el.disabled).toBe(false)
    expect(el.hidden).toBe(false)
    expect(el.selectedCountry).toBeNull()
    expect(el._query).toBe('')
  })

  it('renders instructions text when enabled', async () => {
    el.disabled = false
    await el.updateComplete
    const instructions = el.renderRoot.querySelector('[data-cy="picker-instructions"]')
    expect(instructions.textContent).toContain('Look at the Street View')
  })

  it('renders disabled instructions when disabled', async () => {
    el.disabled = true
    await el.updateComplete
    const instructions = el.renderRoot.querySelector('[data-cy="picker-instructions"]')
    expect(instructions.textContent).toContain('country picker will be enabled')
  })

  it('renders search input', async () => {
    await el.updateComplete
    const search = el.renderRoot.querySelector('[data-cy="country-search"]')
    expect(search).toBeTruthy()
    expect(search.placeholder).toBe('Search countries...')
  })

  it('disables search input when disabled', async () => {
    el.disabled = true
    await el.updateComplete
    const search = el.renderRoot.querySelector('[data-cy="country-search"]')
    expect(search.disabled).toBe(true)
  })

  it('renders submit button', async () => {
    await el.updateComplete
    const submit = el.renderRoot.querySelector('[data-cy="submit-guess"]')
    expect(submit).toBeTruthy()
    expect(submit.textContent).toBe('Submit Guess')
  })

  it('submit button is disabled when no country selected', async () => {
    el.selectedCountry = null
    await el.updateComplete
    const submit = el.renderRoot.querySelector('[data-cy="submit-guess"]')
    expect(submit.disabled).toBe(true)
  })

  it('submit button is enabled when country selected and not disabled', async () => {
    el.selectedCountry = 'US'
    el.disabled = false
    await el.updateComplete
    const submit = el.renderRoot.querySelector('[data-cy="submit-guess"]')
    expect(submit.disabled).toBe(false)
  })

  it('renders country flags', async () => {
    await el.updateComplete
    const flags = el.renderRoot.querySelectorAll('.country-picker__flag')
    expect(flags.length).toBeGreaterThan(50)
  })

  it('renders continent headings', async () => {
    await el.updateComplete
    const continents = el.renderRoot.querySelectorAll('.country-picker__continent-name')
    expect(continents.length).toBeGreaterThanOrEqual(6)
  })

  it('selects country on click', async () => {
    await el.updateComplete
    const usFlag = el.renderRoot.querySelector('[data-code="US"]')
    usFlag.click()
    await el.updateComplete
    expect(el.selectedCountry).toBe('US')
  })

  it('does not select country when disabled', async () => {
    el.disabled = true
    await el.updateComplete
    el._selectCountry('US')
    await el.updateComplete
    expect(el.selectedCountry).toBeNull()
  })

  it('applies selected class to chosen country', async () => {
    el._selectCountry('US')
    await el.updateComplete
    const usFlag = el.renderRoot.querySelector('[data-code="US"]')
    expect(usFlag.classList.contains('country-picker__flag--selected')).toBe(true)
  })

  it('dispatches guess event on submit', async () => {
    el.selectedCountry = 'FR'
    await el.updateComplete

    const handler = vi.fn()
    el.addEventListener('guess', handler)

    const submit = el.renderRoot.querySelector('[data-cy="submit-guess"]')
    submit.click()

    expect(handler).toHaveBeenCalledTimes(1)
    expect(handler.mock.calls[0][0].detail.countryCode).toBe('FR')
    expect(handler.mock.calls[0][0].bubbles).toBe(true)
    expect(handler.mock.calls[0][0].composed).toBe(true)
  })

  it('does not dispatch guess event when no country selected', async () => {
    el.selectedCountry = null
    await el.updateComplete

    const handler = vi.fn()
    el.addEventListener('guess', handler)
    el._submit()
    expect(handler).not.toHaveBeenCalled()
  })

  it('filters countries by search query (name)', async () => {
    el._query = 'united'
    await el.updateComplete
    const flags = el.renderRoot.querySelectorAll('.country-picker__flag')
    const names = [...flags].map(f => f.querySelector('.country-picker__flag-name').textContent)
    names.forEach(name => {
      expect(name.toLowerCase()).toContain('united')
    })
  })

  it('filters countries by search query (code)', async () => {
    el._query = 'us'
    await el.updateComplete
    const flags = el.renderRoot.querySelectorAll('.country-picker__flag')
    expect(flags.length).toBeGreaterThan(0)
  })

  it('shows all countries when query is empty', async () => {
    el._query = ''
    await el.updateComplete
    const flags = el.renderRoot.querySelectorAll('.country-picker__flag')
    expect(flags.length).toBeGreaterThan(50)
  })

  it('_onSearch updates query from input event', () => {
    el._onSearch({ target: { value: '  France  ' } })
    expect(el._query).toBe('france')
  })

  it('reset() clears selection and query', () => {
    el.selectedCountry = 'us'
    el._query = 'test'
    el.reset()
    expect(el.selectedCountry).toBeNull()
    expect(el._query).toBe('')
  })

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

  it('renders pinned section when pinned countries exist', async () => {
    localStorage.setItem('openguessr:pinned-countries', JSON.stringify(['US', 'FR']))
    // Create a new element to pick up localStorage on first render
    el.remove()
    const el2 = document.createElement('country-picker')
    document.body.appendChild(el2)
    await el2.updateComplete
    const pinned = el2.renderRoot.querySelector('.country-picker__pinned')
    expect(pinned).toBeTruthy()
    const pinnedLabel = pinned.querySelector('.country-picker__continent-name')
    expect(pinnedLabel.textContent).toBe('Recent')
    el2.remove()
    // Reassign el so afterEach cleanup works
    el = document.createElement('country-picker')
    document.body.appendChild(el)
  })

  it('does not render pinned section when no pinned countries', async () => {
    localStorage.removeItem('openguessr:pinned-countries')
    await el.updateComplete
    const pinned = el.renderRoot.querySelector('.country-picker__pinned')
    expect(pinned).toBeNull()
  })

  it('hides continent when all countries filtered out', async () => {
    el._query = 'xyznonexistent'
    await el.updateComplete
    const continents = el.renderRoot.querySelectorAll('.country-picker__continent')
    expect(continents.length).toBe(0)
  })

  it('_matchesQuery returns true for empty query', () => {
    el._query = ''
    expect(el._matchesQuery({ name: 'France', code: 'fr' })).toBe(true)
  })

  it('_matchesQuery matches by name', () => {
    el._query = 'fran'
    expect(el._matchesQuery({ name: 'France', code: 'fr' })).toBe(true)
  })

  it('_matchesQuery matches by code', () => {
    el._query = 'fr'
    expect(el._matchesQuery({ name: 'France', code: 'fr' })).toBe(true)
  })

  it('_matchesQuery returns false when no match', () => {
    el._query = 'xyz'
    expect(el._matchesQuery({ name: 'France', code: 'fr' })).toBe(false)
  })

  it('applies disabled class to container when disabled', async () => {
    el.disabled = true
    await el.updateComplete
    const container = el.renderRoot.querySelector('.country-picker')
    expect(container.classList.contains('country-picker--disabled')).toBe(true)
  })

  it('_getPinned returns empty array when no localStorage data', () => {
    localStorage.removeItem('openguessr:pinned-countries')
    expect(el._getPinned()).toEqual([])
  })

  it('_getPinned slices to max 3', () => {
    localStorage.setItem('openguessr:pinned-countries', JSON.stringify(['US', 'FR', 'DE', 'GB', 'JP']))
    expect(el._getPinned().length).toBe(3)
  })
})
