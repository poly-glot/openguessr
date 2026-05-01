import { LitElement, html, css } from 'lit'
import { repeat } from 'lit/directives/repeat.js'
import { getAllCountriesSorted, getCountryByCode, FLAG_SPRITE_URL } from '../../data/countries'
import { buttonStyles } from '../shared-styles'

const PINNED_KEY = 'openguessr:pinned-countries'
const MAX_PINNED = 3

// Shared sprite fetch — kicked off once across all instances. Browsers
// resolve external `<use href="…#id">` asynchronously, and per-shadow-root
// `<use>` references racing the fetch can render blank rectangles. Inline
// the sprite into each shadow root after a single fetch so every flag
// resolves locally and instantly.
let _spritePromise = null
function loadSprite () {
  if (!_spritePromise) {
    _spritePromise = fetch(FLAG_SPRITE_URL)
      .then(r => r.ok ? r.text() : Promise.reject(new Error(`sprite ${r.status}`)))
      .catch(err => { _spritePromise = null; throw err })
  }
  return _spritePromise
}

export class CountryPicker extends LitElement {
  static properties = {
    disabled: { type: Boolean, reflect: true },
    hidden: { type: Boolean, reflect: true },
    selectedCountry: { type: String },
    _query: { state: true },
    _open: { state: true },
    _highlight: { state: true }
  }

  static styles = [buttonStyles, css`
    :host {
      display: block;
      /* Anchor the dropdown above sibling map panes (Leaflet panes go
         up to ~700 in their own stacking context). */
      position: relative;
      z-index: 1100;
    }
    :host([hidden]) { display: none !important; }

    .country-picker { padding: 20px 40px; display: flex; flex-direction: column; gap: 12px; }

    .country-picker__instructions {
      font-size: 0.85rem;
      color: #1a1a1a;
      background: #fff8e1;
      border: 2px solid #f9a825;
      border-radius: 6px;
      padding: 12px 14px;
      line-height: 1.4;
      font-weight: 600;
      text-align: center;
    }

    .combobox { position: relative; }

    .combobox__field {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 100%;
      padding: 10px 12px;
      border: 1px solid var(--borderColor, rgb(0 0 0 / 15%));
      border-radius: 6px;
      background: #fff;
      transition: border-color 0.15s, box-shadow 0.15s;
      box-sizing: border-box;
      cursor: text;
    }

    .combobox__field:focus-within {
      border-color: var(--brand, #111);
      box-shadow: 0 0 0 3px rgb(0 0 0 / 10%);
    }

    .combobox__field--selected { background: #f7f7f7; }

    .combobox__flag {
      width: 24px;
      height: 18px;
      flex-shrink: 0;
      border-radius: 2px;
      overflow: hidden;
      background: #eee;
      display: inline-block;
    }

    .combobox__flag svg { width: 100%; height: 100%; display: block; }

    .combobox__input {
      flex: 1;
      border: none;
      outline: none;
      font-size: 0.9rem;
      background: transparent;
      color: #222;
      min-width: 0;
    }

    .combobox__input::placeholder { color: #999; }

    .combobox__clear {
      appearance: none;
      background: none !important;
      border: none;
      cursor: pointer;
      color: #888;
      font-size: 1.4rem;
      padding: 0 6px;
      line-height: 1;
      min-width: 0;
      text-transform: none;
    }

    .combobox__clear:hover { color: #222; background: none !important; }

    .combobox__chevron {
      width: 14px;
      height: 14px;
      color: #888;
      flex-shrink: 0;
      pointer-events: none;
      transition: transform 0.15s;
    }

    .combobox[data-open="true"] .combobox__chevron { transform: rotate(180deg); }

    .combobox__listbox {
      position: absolute;
      top: calc(100% + 4px);
      left: 0;
      right: 0;
      background: #fff;
      border: 1px solid var(--borderColor, rgb(0 0 0 / 15%));
      border-radius: 6px;
      box-shadow: 0 8px 24px rgb(0 0 0 / 12%);
      max-height: 320px;
      overflow-y: auto;
      /* Above Leaflet's tooltipPane (z=650) and any other map layers */
      z-index: 1100;
      padding: 4px;
      margin: 0;
      list-style: none;
    }

    .combobox__group-label {
      font-size: 0.65rem;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: #888;
      font-weight: 700;
      padding: 8px 10px 4px;
    }

    .combobox__option {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 10px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.85rem;
      color: #222;
      min-height: 36px;
    }

    .combobox__option svg {
      width: 22px;
      height: 16px;
      border-radius: 2px;
      flex-shrink: 0;
      box-shadow: 0 0 0 1px rgb(0 0 0 / 8%);
    }

    .combobox__option--active { background: #f0f0f0; }
    .combobox__option--selected { background: #e6f0ff; font-weight: 600; }

    .combobox__option-name { flex: 1; }
    .combobox__option-code {
      font-size: 0.7rem;
      color: #999;
      letter-spacing: 0.05em;
    }

    .combobox__empty {
      padding: 14px;
      text-align: center;
      color: #888;
      font-size: 0.85rem;
    }

    .country-picker--disabled { opacity: 0.5; pointer-events: none; }

    @media (max-width: 900px) {
      .country-picker { padding: 16px 24px; }
      .country-picker__instructions { display: none; }
      .combobox__listbox { max-height: 240px; }
    }
  `]

  constructor () {
    super()
    this.disabled = false
    this.hidden = false
    this.selectedCountry = null
    this._query = ''
    this._open = false
    this._highlight = 0
    this._all = getAllCountriesSorted()
    this._onDocClick = this._onDocClick.bind(this)
  }

  connectedCallback () {
    super.connectedCallback()
    document.addEventListener('mousedown', this._onDocClick)
  }

  firstUpdated () {
    this._injectSprite()
  }

  async _injectSprite () {
    if (this._spriteInjected) return
    try {
      const text = await loadSprite()
      if (!this.renderRoot || this._spriteInjected) return
      const wrapper = document.createElement('div')
      wrapper.innerHTML = text
      const svg = wrapper.querySelector('svg')
      if (svg) {
        svg.setAttribute('style', 'display:none')
        this.renderRoot.prepend(svg)
        this._spriteInjected = true
        this.requestUpdate()
      }
    } catch {
      // Sprite failed to load — flags will render as empty squares
    }
  }

  disconnectedCallback () {
    super.disconnectedCallback()
    document.removeEventListener('mousedown', this._onDocClick)
  }

  reset () {
    this.selectedCountry = null
    this._query = ''
    this._open = false
    this._highlight = 0
  }

  savePinned (code) {
    const pinned = JSON.parse(localStorage.getItem(PINNED_KEY) || '[]')
    const updated = [code, ...pinned.filter(c => c !== code)].slice(0, MAX_PINNED)
    localStorage.setItem(PINNED_KEY, JSON.stringify(updated))
    this.requestUpdate()
  }

  _getPinned () {
    return JSON.parse(localStorage.getItem(PINNED_KEY) || '[]').slice(0, MAX_PINNED)
  }

  _onDocClick (e) {
    if (!this._open) return
    const path = e.composedPath()
    if (!path.includes(this)) this._open = false
  }

  _matchesQuery (country) {
    if (!this._query) return true
    const q = this._query.toLowerCase()
    return country.name.toLowerCase().includes(q) ||
           country.code.toLowerCase().startsWith(q)
  }

  _filtered () {
    if (!this._query) return this._all
    return this._all.filter(c => this._matchesQuery(c))
  }

  _pinnedSection () {
    const codes = this._getPinned()
    if (this._query || codes.length === 0) return []
    return codes.map(c => getCountryByCode(c)).filter(Boolean)
  }

  // Flat list combining pinned + filtered countries; pinned items
  // are repeated in the main list so navigation stays simple.
  _visibleOptions () {
    const pinned = this._pinnedSection()
    const filtered = this._filtered()
    const out = []
    for (const c of pinned) out.push({ ...c, _section: 'recent' })
    for (const c of filtered) out.push({ ...c, _section: 'all' })
    return out
  }

  _onInput (e) {
    this._query = e.target.value
    this._open = true
    this._highlight = 0
    // typing means user is editing — drop the locked-in selection
    // until they pick again
    if (this.selectedCountry) this.selectedCountry = null
  }

  _onFocus () {
    if (this.disabled) return
    this._open = true
  }

  _openDropdown () {
    if (this.disabled) return
    this._open = true
    const input = this.renderRoot?.querySelector('.combobox__input')
    input?.focus()
  }

  _onKeyDown (e) {
    if (this.disabled) return
    const options = this._visibleOptions()

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        if (!this._open) { this._open = true; return }
        this._highlight = Math.min(options.length - 1, this._highlight + 1)
        this._scrollHighlightIntoView()
        break
      case 'ArrowUp':
        e.preventDefault()
        if (!this._open) { this._open = true; return }
        this._highlight = Math.max(0, this._highlight - 1)
        this._scrollHighlightIntoView()
        break
      case 'Enter':
        if (this._open && options[this._highlight]) {
          e.preventDefault()
          this._pickCountry(options[this._highlight].code)
        }
        break
      case 'Escape':
        if (this._open) {
          e.preventDefault()
          this._open = false
        }
        break
      case 'Home':
        if (this._open) { e.preventDefault(); this._highlight = 0 }
        break
      case 'End':
        if (this._open) { e.preventDefault(); this._highlight = options.length - 1 }
        break
    }
  }

  _scrollHighlightIntoView () {
    this.updateComplete.then(() => {
      const el = this.renderRoot?.querySelector('.combobox__option--active')
      if (el && typeof el.scrollIntoView === 'function') {
        el.scrollIntoView({ block: 'nearest' })
      }
    })
  }

  _pickCountry (code) {
    if (this.disabled) return
    const country = getCountryByCode(code)
    if (!country) return
    this.selectedCountry = code
    this._query = country.name
    this._open = false
    this._highlight = 0
    this.savePinned(code)
    // Picking a country is also the "go look there" signal — listeners
    // (game-screen → guess-map) fly the map to the country. The actual
    // guess submission still happens via the map's Submit Guess CTA.
    this.dispatchEvent(new CustomEvent('country-selected', {
      detail: { code, name: country.name },
      bubbles: true,
      composed: true
    }))
  }

  _clearSelection () {
    if (this.disabled) return
    this.selectedCountry = null
    this._query = ''
    this._open = true
    this._highlight = 0
    const input = this.renderRoot?.querySelector('.combobox__input')
    input?.focus()
    this.dispatchEvent(new CustomEvent('country-cleared', {
      bubbles: true,
      composed: true
    }))
  }

  _renderFlag (code) {
    // After firstUpdated, the sprite lives in this shadow root, so
    // `<use href="#flag-xx">` resolves locally without a network hop.
    // Before injection we fall back to the external sprite URL — same
    // visual result, just one fetch behind the scenes.
    const local = `#flag-${code.toLowerCase()}`
    const href = this._spriteInjected ? local : `${FLAG_SPRITE_URL}${local}`
    return html`
      <svg viewBox="0 0 640 480" aria-hidden="true">
        <use href=${href}></use>
      </svg>
    `
  }

  _renderOption (country, index) {
    const isHighlight = index === this._highlight
    const isSelected = country.code === this.selectedCountry
    return html`
      <li
        role="option"
        id="opt-${country.code}-${country._section}"
        aria-selected=${isSelected}
        class="combobox__option ${isHighlight ? 'combobox__option--active' : ''} ${isSelected ? 'combobox__option--selected' : ''}"
        data-cy="option-${country.code}"
        data-code=${country.code}
        @mouseenter=${() => { this._highlight = index }}
        @mousedown=${(e) => { e.preventDefault(); this._pickCountry(country.code) }}
      >
        ${this._renderFlag(country.code)}
        <span class="combobox__option-name">${country.name}</span>
        <span class="combobox__option-code">${country.code}</span>
      </li>
    `
  }

  _renderListbox () {
    const options = this._visibleOptions()
    if (options.length === 0) {
      return html`<div class="combobox__empty" data-cy="picker-empty">No countries match "${this._query}"</div>`
    }

    const pinnedCount = this._pinnedSection().length
    const items = []

    if (pinnedCount > 0) {
      items.push(html`<li class="combobox__group-label" role="presentation">Recent</li>`)
      for (let i = 0; i < pinnedCount; i++) {
        items.push(this._renderOption(options[i], i))
      }
      items.push(html`<li class="combobox__group-label" role="presentation">All countries</li>`)
    }

    for (let i = pinnedCount; i < options.length; i++) {
      items.push(this._renderOption(options[i], i))
    }

    return html`
      <ul
        class="combobox__listbox"
        role="listbox"
        id="country-picker-listbox"
        data-cy="picker-listbox"
      >
        ${repeat(items, (_, i) => i, item => item)}
      </ul>
    `
  }

  render () {
    const instructionText = this.disabled
      ? 'The country picker will be enabled once the host starts the game.'
      : 'Type a country to fly the map there, then submit your guess from below.'

    const selected = this.selectedCountry ? getCountryByCode(this.selectedCountry) : null
    const showFlag = !!selected
    const placeholder = selected ? selected.name : 'Type a country…'
    const activeId = this._open ? this._visibleOptions()[this._highlight]?.code : null

    return html`
      <div class="country-picker ${this.disabled ? 'country-picker--disabled' : ''}" id="js-country-picker">
        <div class="country-picker__instructions" data-cy="picker-instructions">
          ${instructionText}
        </div>

        <div class="combobox" data-open=${String(this._open)} data-cy="country-combobox">
          <div
            class="combobox__field ${selected ? 'combobox__field--selected' : ''}"
            @click=${this._openDropdown}
          >
            ${showFlag ? html`<span class="combobox__flag">${this._renderFlag(selected.code)}</span>` : ''}
            <input
              type="text"
              class="combobox__input"
              role="combobox"
              aria-autocomplete="list"
              aria-expanded=${String(this._open)}
              aria-controls="country-picker-listbox"
              aria-activedescendant=${activeId ? `opt-${activeId}-${this._open ? 'all' : ''}` : ''}
              autocomplete="off"
              spellcheck="false"
              data-cy="country-search"
              placeholder=${placeholder}
              .value=${this._query}
              ?disabled=${this.disabled}
              @input=${this._onInput}
              @focus=${this._onFocus}
              @keydown=${this._onKeyDown}
            />
            ${this._query || selected ? html`
              <button
                type="button"
                class="combobox__clear"
                aria-label="Clear selection"
                data-cy="picker-clear"
                @click=${this._clearSelection}
              >×</button>
            ` : ''}
            <svg class="combobox__chevron" viewBox="0 0 12 12" aria-hidden="true">
              <path d="M2 4l4 4 4-4" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>

          ${this._open ? this._renderListbox() : ''}
        </div>
      </div>
    `
  }
}

if (!customElements.get('country-picker')) {
  customElements.define('country-picker', CountryPicker)
}
