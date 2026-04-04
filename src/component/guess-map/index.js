import { LitElement, html, css, unsafeCSS } from 'lit'
import L from 'leaflet'
import leafletCss from 'leaflet/dist/leaflet.css?inline'

// Fix Leaflet default icon paths broken by bundlers
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow
})

export class GuessMap extends LitElement {
  static properties = {
    disabled: { type: Boolean, reflect: true },
    hidden: { type: Boolean, reflect: true },
    selectedLat: { state: true },
    selectedLng: { state: true }
  }

  static styles = [
    css`${unsafeCSS(leafletCss)}`,
    css`
      :host { display: block; height: 100%; }
      :host([hidden]) { display: none !important; }

      .guess-map {
        display: flex;
        flex-direction: column;
        height: 100%;
      }

      .guess-map__container {
        flex: 1;
        min-height: 0;
        aspect-ratio: 16 / 9;
        background: #fff;
      }

      .guess-map__actions {
        padding: 8px 12px;
        background: #fafafa;
        border-top: 1px solid var(--borderColor, rgb(0 0 0 / 15%));
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .guess-map__submit {
        flex: 1;
        padding: 10px 16px;
        background: #111;
        color: #fff;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 0.85rem;
        font-weight: 600;
        transition: background 0.15s;
      }

      .guess-map__submit:hover:not(:disabled) { background: #333; }

      .guess-map__submit:disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }

      .guess-map__hint {
        font-size: 0.75rem;
        color: #999;
      }

      .country-label {
        background: none;
        border: none;
        box-shadow: none;
        font-size: 10px;
        font-weight: 500;
        color: #999;
        white-space: nowrap;
      }

      .country-label::before {
        display: none;
      }
    `
  ]

  constructor () {
    super()
    this.disabled = false
    this.hidden = false
    this.selectedLat = null
    this.selectedLng = null
    this._map = null
    this._marker = null
  }

  firstUpdated () {
    this._initMap()
  }

  updated (changed) {
    if (changed.has('hidden') && !this.hidden && this._map) {
      setTimeout(() => this._map.invalidateSize(), 0)
    }
  }

  _initMap () {
    const container = this.renderRoot.querySelector('.guess-map__container')
    if (!container || this._map) return

    this._map = L.map(container, {
      center: [20, 0],
      zoom: 1,
      minZoom: 1,
      worldCopyJump: true,
      backgroundColor: '#fff'
    })

    fetch('/assets/world-borders.geojson')
      .then(r => r.json())
      .then(data => {
        L.geoJSON(data, {
          style: {
            color: '#ccc',
            weight: 1,
            fillColor: '#f0f0f0',
            fillOpacity: 1
          },
          onEachFeature: (feature, layer) => {
            if (feature.properties?.name) {
              layer.bindTooltip(feature.properties.name, {
                permanent: true,
                direction: 'center',
                className: 'country-label'
              })
            }
          }
        }).addTo(this._map)

        this._map.on('zoomend', () => this._toggleLabels())
        this._toggleLabels()
      })

    this._map.on('click', (e) => {
      if (this.disabled) return
      this.selectedLat = e.latlng.lat
      this.selectedLng = e.latlng.lng

      if (this._marker) {
        this._marker.setLatLng(e.latlng)
      } else {
        this._marker = L.marker(e.latlng).addTo(this._map)
      }
    })
  }

  _toggleLabels () {
    if (!this._map) return
    const zoom = this._map.getZoom()
    const show = zoom >= 3
    this.renderRoot.querySelectorAll('.country-label').forEach(el => {
      el.style.display = show ? '' : 'none'
    })
  }

  reset () {
    if (this._marker) {
      this._map.removeLayer(this._marker)
      this._marker = null
    }
    this.selectedLat = null
    this.selectedLng = null
    if (this._map) {
      this._map.setView([20, 0], 1)
    }
  }

  _submit () {
    if (this.selectedLat == null || this.selectedLng == null || this.disabled) return
    this.dispatchEvent(new CustomEvent('guess', {
      detail: { lat: this.selectedLat, lng: this.selectedLng },
      bubbles: true,
      composed: true
    }))
  }

  render () {
    const hasPin = this.selectedLat != null
    return html`
      <div class="guess-map">
        <div class="guess-map__container"></div>
        <div class="guess-map__actions">
          <button
            class="guess-map__submit"
            ?disabled=${!hasPin || this.disabled}
            @click=${this._submit}
            data-cy="submit-guess"
          >
            ${hasPin ? 'Submit Guess' : 'Click map to place pin'}
          </button>
        </div>
      </div>
    `
  }
}

customElements.define('guess-map', GuessMap)
