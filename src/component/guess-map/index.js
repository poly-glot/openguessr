import { LitElement, html, css, unsafeCSS } from 'lit'
import L from 'leaflet'
import leafletCss from 'leaflet/dist/leaflet.css?inline'
import { GEO_NAME_ALIASES, COUNTRY_CENTROIDS, getCountryByCode } from '../../data/countries'

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
        font-size: 11px;
        font-weight: 600;
        color: #444;
        text-shadow: 0 0 3px #fff, 0 0 3px #fff;
        white-space: nowrap;
        pointer-events: none;
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
    this._resizeObserver = null
    this._featuresByName = new Map()
    this._geoLayerReady = null
    this._resolveGeoLayerReady = null
  }

  firstUpdated () {
    this._initMap()
  }

  disconnectedCallback () {
    super.disconnectedCallback()
    if (this._resizeObserver) {
      this._resizeObserver.disconnect()
      this._resizeObserver = null
    }
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
      zoom: 3,
      minZoom: 2,
      worldCopyJump: true,
      backgroundColor: '#fff'
    })

    this._geoLayerReady = new Promise(resolve => { this._resolveGeoLayerReady = resolve })

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
            const name = feature.properties?.name
            if (name) {
              this._featuresByName.set(name, layer)
              layer.bindTooltip(name, {
                permanent: true,
                direction: 'center',
                className: 'country-label'
              })
            }
          }
        }).addTo(this._map)

        this._map.on('zoomend', () => this._toggleLabels())
        this._toggleLabels()
        this._resolveGeoLayerReady?.()
      })
      .catch(err => console.warn('Failed to load borders:', err))

    // Guard against container resizes (sidebar flex layout may settle after
    // mount, leaving the Leaflet viewport at 0×0 with blank tiles until an
    // invalidateSize() is triggered). Also handles orientation changes.
    this._resizeObserver = new ResizeObserver(() => {
      if (this._map) this._map.invalidateSize()
    })
    this._resizeObserver.observe(container)

    this._map.on('click', (e) => {
      if (this.disabled) return
      this._setMarker(e.latlng.lat, e.latlng.lng)
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
      this._map.setView([20, 0], 3)
    }
  }

  // Drop a marker at lat/lng — separated out so the combobox flow shares
  // the same selection state as a manual map click.
  _setMarker (lat, lng) {
    this.selectedLat = lat
    this.selectedLng = lng
    const ll = L.latLng(lat, lng)
    if (this._marker) {
      this._marker.setLatLng(ll)
    } else if (this._map) {
      this._marker = L.marker(ll).addTo(this._map)
    }
  }

  async flyToCountry (code) {
    if (this.disabled || !code || !this._map) return
    const country = getCountryByCode(code)
    if (!country) return

    const fallback = COUNTRY_CENTROIDS[code]
    if (fallback) {
      this._map.flyTo([fallback.lat, fallback.lng], fallback.zoom, { duration: 0.6 })
      this._setMarker(fallback.lat, fallback.lng)
      return
    }

    if (this._geoLayerReady) await this._geoLayerReady

    const lookupName = GEO_NAME_ALIASES[code] || country.name
    const layer = this._featuresByName.get(lookupName)
    if (!layer) return

    const bounds = layer.getBounds()
    this._map.flyToBounds(bounds, { padding: [20, 20], duration: 0.6, maxZoom: 6 })
    const center = bounds.getCenter()
    this._setMarker(center.lat, center.lng)
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
        <div class="guess-map__container" tabindex="0" role="application" aria-label="Guess map — click to place your pin"></div>
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
