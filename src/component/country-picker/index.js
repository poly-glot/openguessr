import { LitElement, html, css } from 'lit'
import { continents, getFlagUrl, getCountryByCode } from '../../data/countries'
import { buttonStyles } from '../shared-styles'

const PINNED_KEY = 'openguessr:pinned-countries'

export class CountryPicker extends LitElement {
  static properties = {
    disabled: { type: Boolean, reflect: true },
    hidden: { type: Boolean, reflect: true },
    selectedCountry: { type: String },
    _query: { state: true }
  }

  static styles = [buttonStyles, css`
    :host { display: block; }
    :host([hidden]) { display: none !important; }

    .country-picker { padding: 0; }

    .country-picker__sticky {
      position: sticky;
      top: 0;
      z-index: 2;
      background: #fafafa;
      padding: 20px 40px 0;
      border-bottom: 1px solid var(--borderColor, rgb(0 0 0 / 15%));
    }

    .country-picker__list {
      padding: 16px 40px 20px;
    }

    .country-picker__instructions {
      font-size: 0.85rem;
      color: #1a1a1a;
      background: #fff8e1;
      border: 2px solid #f9a825;
      border-radius: 6px;
      padding: 14px 16px;
      margin-bottom: 16px;
      line-height: 1.5;
      font-weight: 600;
      text-align: center;
    }

    .country-picker__search {
      width: 100%;
      padding: 8px 12px;
      border: 1px solid var(--borderColor, rgb(0 0 0 / 15%));
      border-radius: 4px;
      font-size: 0.85rem;
      margin-bottom: 16px;
      outline: none;
      box-sizing: border-box;
    }

    .country-picker__search:focus {
      border-color: var(--brand, #111);
      box-shadow: 0 0 0 2px rgb(0 0 0 / 10%);
    }

    .country-picker__submit { margin-top: 0; margin-bottom: 16px; }
    .country-picker__submit button { width: 100%; }

    .country-picker__continent { margin-bottom: 16px; }

    .country-picker__continent-name {
      font-size: 0.7rem;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: #888;
      font-weight: 600;
      margin-bottom: 8px;
    }

    .country-picker__flags {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .country-picker__flag {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px;
      min-height: 44px;
      border: 1px solid var(--borderColor, rgb(0 0 0 / 15%));
      border-radius: 4px;
      cursor: pointer;
      background: #fff;
      font-size: 0.82rem;
      transition: all 0.15s;
      width: 100%;
      box-sizing: border-box;
      text-align: left;
    }

    .country-picker__flag:hover { border-color: #888; background: #f5f5f5; }

    .country-picker__flag--selected {
      border-color: var(--brand, #111);
      background: #f0f0f0;
      box-shadow: 0 0 0 2px var(--brand, #111);
    }

    .country-picker__flag--disabled {
      opacity: 0.4;
      pointer-events: none;
    }

    .country-picker__flag img { width: 20px; height: 14px; object-fit: cover; }

    .country-picker__flag-name {
      font-weight: 500;
      color: #222;
      white-space: nowrap;
    }

    .country-picker__pinned {
      padding-bottom: 12px;
      margin-bottom: 12px;
      border-bottom: 1px solid var(--borderColor, rgb(0 0 0 / 15%));
    }

    .country-picker--disabled { opacity: 0.5; pointer-events: none; }

    @media (max-width: 900px) {
      .country-picker__sticky { padding: 16px 24px 0; }
      .country-picker__list { padding: 12px 24px 16px; }
      .country-picker__instructions { display: none; }
      .country-picker__search { margin-bottom: 8px; }
    }
  `]

  constructor () {
    super()
    this.disabled = false
    this.hidden = false
    this.selectedCountry = null
    this._query = ''
  }

  reset () {
    this.selectedCountry = null
    this._query = ''
  }

  savePinned (code) {
    const pinned = JSON.parse(localStorage.getItem(PINNED_KEY) || '[]')
    const updated = [code, ...pinned.filter(c => c !== code)].slice(0, 3)
    localStorage.setItem(PINNED_KEY, JSON.stringify(updated))
    this.requestUpdate()
  }

  _onSearch (e) {
    this._query = e.target.value.toLowerCase().trim()
  }

  _selectCountry (code) {
    if (this.disabled) return
    this.selectedCountry = code
  }

  _submit () {
    if (!this.selectedCountry) return
    this.dispatchEvent(new CustomEvent('guess', {
      detail: { countryCode: this.selectedCountry },
      bubbles: true,
      composed: true
    }))
  }

  _matchesQuery (country) {
    if (!this._query) return true
    return country.name.toLowerCase().includes(this._query) ||
           country.code.toLowerCase().includes(this._query)
  }

  _getPinned () {
    return JSON.parse(localStorage.getItem(PINNED_KEY) || '[]').slice(0, 3)
  }

  _renderFlag (country) {
    const isSelected = country.code === this.selectedCountry
    return html`
      <button
        type="button"
        class="country-picker__flag ${isSelected ? 'country-picker__flag--selected' : ''} ${this.disabled ? 'country-picker__flag--disabled' : ''}"
        data-code=${country.code}
        data-cy="flag-${country.code}"
        @click=${() => this._selectCountry(country.code)}
      >
        <img src=${getFlagUrl(country.code)} alt=${country.name} width="20" height="14" />
        <span class="country-picker__flag-name">${country.name}</span>
      </button>
    `
  }

  _renderPinned () {
    const codes = this._getPinned()
    if (codes.length === 0) return ''

    const countries = codes.map(c => getCountryByCode(c)).filter(Boolean)
    if (countries.length === 0) return ''

    return html`
      <div class="country-picker__continent country-picker__pinned">
        <div class="country-picker__continent-name">Recent</div>
        <div class="country-picker__flags">
          ${countries.map(c => this._renderFlag(c))}
        </div>
      </div>
    `
  }

  _renderContinent (name, countries) {
    const filtered = countries.filter(c => this._matchesQuery(c))
    if (filtered.length === 0) return ''

    return html`
      <div class="country-picker__continent">
        <div class="country-picker__continent-name">${name}</div>
        <div class="country-picker__flags">
          ${filtered.map(c => this._renderFlag(c))}
        </div>
      </div>
    `
  }

  render () {
    const instructionText = this.disabled
      ? 'The country picker will be enabled once the host starts the game.'
      : 'Look at the Street View, then search or browse to find the country. Select it and submit your guess!'

    return html`
      <div class="country-picker ${this.disabled ? 'country-picker--disabled' : ''}" id="js-country-picker">
        <div class="country-picker__sticky">
          <div class="country-picker__instructions" data-cy="picker-instructions">
            ${instructionText}
          </div>

          <input
            type="text"
            placeholder="Search countries..."
            class="country-picker__search"
            data-cy="country-search"
            .value=${this._query}
            ?disabled=${this.disabled}
            @input=${this._onSearch}
          />

          <div class="country-picker__submit">
            <button
              type="button"
              id="js-submit-guess"
              data-cy="submit-guess"
              ?disabled=${!this.selectedCountry || this.disabled}
              @click=${this._submit}
            >Submit Guess</button>
          </div>
        </div>

        <div class="country-picker__list">
          ${this._renderPinned()}

          ${Object.entries(continents).map(([name, countries]) =>
            this._renderContinent(name, countries)
          )}
        </div>
      </div>
    `
  }
}

customElements.define('country-picker', CountryPicker)
