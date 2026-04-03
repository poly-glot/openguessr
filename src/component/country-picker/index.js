import { continents, getFlagUrl, getCountryByCode } from '../../data/countries'

const PINNED_KEY = 'openguessr:pinned-countries'

export class CountryPicker {
  constructor () {
    this.selectedCountry = null
    this.onSubmit = null
  }

  show (disabled = false) {
    const container = document.getElementById('js-continents')
    if (!container) return

    container.innerHTML = ''

    const picker = document.getElementById('js-country-picker')

    this._addInstructions(container, disabled)
    this._addSearch(container, disabled)
    this._addSubmitButton(container, disabled)
    this._addPinnedSection(container, disabled)
    this._addContinentSections(container, disabled)

    if (picker) {
      picker.hidden = false
      picker.classList.toggle('country-picker--disabled', disabled)
    }
  }

  hide () {
    const picker = document.getElementById('js-country-picker')
    if (picker) picker.hidden = true
  }

  reset () {
    this.selectedCountry = null
  }

  disable () {
    document.querySelectorAll('.country-picker__flag').forEach(el => {
      el.classList.add('country-picker__flag--disabled')
    })
    const submitBtn = document.getElementById('js-submit-guess')
    if (submitBtn) submitBtn.disabled = true
  }

  savePinned (code) {
    const pinned = JSON.parse(localStorage.getItem(PINNED_KEY) || '[]')
    const updated = [code, ...pinned.filter(c => c !== code)].slice(0, 3)
    localStorage.setItem(PINNED_KEY, JSON.stringify(updated))
  }

  // ── Private ─────────────────────────────────────────────────

  _addInstructions (container, disabled) {
    const el = document.createElement('div')
    el.className = 'country-picker__instructions'
    el.setAttribute('data-cy', 'picker-instructions')
    el.textContent = disabled
      ? 'The country picker will be enabled once the host starts the game.'
      : 'Look at the Street View, then search or browse to find the country. Select it and submit your guess!'
    container.appendChild(el)
  }

  _addSearch (container, disabled) {
    const input = document.createElement('input')
    input.type = 'text'
    input.placeholder = 'Search countries...'
    input.className = 'country-picker__search'
    input.setAttribute('data-cy', 'country-search')
    if (disabled) input.disabled = true

    input.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase().trim()
      container.querySelectorAll('.country-picker__flag').forEach(btn => {
        const name = btn.querySelector('span')?.textContent?.toLowerCase() || ''
        const code = btn.dataset.code?.toLowerCase() || ''
        btn.style.display = (name.includes(query) || code.includes(query)) ? '' : 'none'
      })
      container.querySelectorAll('.country-picker__continent').forEach(section => {
        const visible = section.querySelectorAll('.country-picker__flag:not([style*="display: none"])')
        section.style.display = visible.length > 0 ? '' : 'none'
      })
    })

    container.appendChild(input)
  }

  _addSubmitButton (container, disabled) {
    const div = document.createElement('div')
    div.className = 'country-picker__submit'

    const btn = document.createElement('button')
    btn.type = 'button'
    btn.id = 'js-submit-guess'
    btn.setAttribute('data-cy', 'submit-guess')
    btn.textContent = 'Submit Guess'
    btn.disabled = true
    btn.addEventListener('click', () => {
      if (this.onSubmit) this.onSubmit(this.selectedCountry)
    })

    div.appendChild(btn)
    container.appendChild(div)
  }

  _addPinnedSection (container, disabled) {
    const codes = JSON.parse(localStorage.getItem(PINNED_KEY) || '[]').slice(0, 3)
    if (codes.length === 0) return

    const section = document.createElement('div')
    section.className = 'country-picker__continent country-picker__pinned'

    const title = document.createElement('div')
    title.className = 'country-picker__continent-name'
    title.textContent = 'Recent'
    section.appendChild(title)

    const flags = document.createElement('div')
    flags.className = 'country-picker__flags'

    for (const code of codes) {
      const country = getCountryByCode(code)
      if (!country) continue
      const btn = this._createFlagButton(country)
      if (disabled) btn.classList.add('country-picker__flag--disabled')
      flags.appendChild(btn)
    }

    section.appendChild(flags)
    container.appendChild(section)
  }

  _addContinentSections (container, disabled) {
    for (const [name, countries] of Object.entries(continents)) {
      const section = document.createElement('div')
      section.className = 'country-picker__continent'

      const title = document.createElement('div')
      title.className = 'country-picker__continent-name'
      title.textContent = name
      section.appendChild(title)

      const flags = document.createElement('div')
      flags.className = 'country-picker__flags'

      for (const country of countries) {
        const btn = this._createFlagButton(country)
        if (disabled) btn.classList.add('country-picker__flag--disabled')
        flags.appendChild(btn)
      }

      section.appendChild(flags)
      container.appendChild(section)
    }
  }

  _createFlagButton (country) {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'country-picker__flag'
    btn.dataset.code = country.code
    btn.setAttribute('data-cy', `flag-${country.code}`)

    const img = document.createElement('img')
    img.src = getFlagUrl(country.code)
    img.alt = country.name
    img.width = 20
    img.height = 14

    const span = document.createElement('span')
    span.className = 'country-picker__flag-name'
    span.textContent = country.name

    btn.appendChild(img)
    btn.appendChild(span)
    btn.addEventListener('click', () => this._onFlagClick(country.code))

    return btn
  }

  _onFlagClick (code) {
    document.querySelectorAll('.country-picker__flag--selected').forEach(el => {
      el.classList.remove('country-picker__flag--selected')
    })

    this.selectedCountry = code
    document.querySelectorAll(`.country-picker__flag[data-code="${code}"]`).forEach(el => {
      el.classList.add('country-picker__flag--selected')
    })

    const submitBtn = document.getElementById('js-submit-guess')
    if (submitBtn) submitBtn.disabled = false
  }
}
