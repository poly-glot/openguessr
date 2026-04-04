import { LitElement, html, css, unsafeCSS } from 'lit'
import L from 'leaflet'
import leafletCss from 'leaflet/dist/leaflet.css?inline'

import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow
})

function getMotivation (score) {
  if (score >= 5000) return 'Perfect!'
  if (score >= 4900) return 'Incredible!'
  if (score >= 4500) return 'Amazing!'
  if (score >= 4000) return 'Great guess!'
  if (score >= 3000) return 'Not bad!'
  if (score >= 2000) return 'Could be better'
  if (score >= 1000) return 'Keep trying!'
  if (score >= 500) return 'Way off...'
  return 'Better luck next time!'
}

function formatDistance (km) {
  if (km == null) return ''
  if (km < 1) return `${Math.round(km * 1000)} m`
  if (km < 100) return `${km.toFixed(1)} km`
  return `${Math.round(km).toLocaleString()} km`
}

const answerIcon = L.icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
  className: 'result-map__answer-marker'
})

export class ResultMap extends LitElement {
  static properties = {
    guessLat: { type: Number },
    guessLng: { type: Number },
    answerLat: { type: Number },
    answerLng: { type: Number },
    distanceKm: { type: Number },
    score: { type: Number },
    visible: { type: Boolean, reflect: true },
    waitingForHost: { type: Boolean, attribute: 'waiting-for-host' }
  }

  static styles = [
    css`${unsafeCSS(leafletCss)}`,
    css`
      :host { display: contents; }
      :host(:not([visible])) .result-map { display: none; }

      .result-map {
        position: absolute;
        inset: 0;
        z-index: 10;
        display: flex;
        flex-direction: column;
        background: #fff;
      }

      .result-map__header {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 16px;
        background: rgba(255, 255, 255, 0.95);
        backdrop-filter: blur(8px);
        border-bottom: 1px solid var(--borderColor, rgb(0 0 0 / 15%));
        z-index: 2;
      }

      .result-map__score {
        font-size: 1.3rem;
        font-weight: 700;
        white-space: nowrap;
      }

      .result-map__score--great { color: var(--color-correct, #16a34a); }
      .result-map__score--ok { color: #d97706; }
      .result-map__score--poor { color: var(--color-error, #ac1b11); }

      .result-map__distance {
        font-size: 0.9rem;
        font-weight: 600;
        color: #555;
        white-space: nowrap;
      }

      .result-map__motivation {
        font-size: 0.8rem;
        color: #999;
        font-style: italic;
        flex: 1;
      }

      .result-map__close {
        appearance: none;
        background: transparent;
        border: 1px solid var(--borderColor, rgb(0 0 0 / 15%));
        border-radius: 4px;
        cursor: pointer;
        font-size: 1rem;
        color: #666;
        min-width: 32px;
        width: 32px;
        height: 32px;
        padding: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        transition: background 0.15s;
      }

      .result-map__close:hover { background: #eee; color: #222; }

      .result-map__container {
        flex: 1;
        min-height: 0;
        background: #fff;
      }

      .result-map__waiting {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 0.78rem;
        color: #888;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }

      .result-map__miss {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #888;
        font-size: 0.9rem;
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

      .result-map__answer-marker {
        filter: hue-rotate(120deg);
      }
    `
  ]

  constructor () {
    super()
    this.guessLat = null
    this.guessLng = null
    this.answerLat = null
    this.answerLng = null
    this.distanceKm = null
    this.score = 0
    this.visible = false
    this.waitingForHost = false
    this._map = null
  }

  updated (changed) {
    if (changed.has('visible') && this.visible) {
      this.updateComplete.then(() => this._renderResultMap())
    }
  }

  _renderResultMap () {
    const container = this.renderRoot.querySelector('.result-map__container')
    if (!container) return

    // Clean up previous map
    if (this._map) {
      this._map.remove()
      this._map = null
    }

    this._map = L.map(container, { zoomControl: true, backgroundColor: '#fff' })

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

    const hasGuess = this.guessLat != null && this.guessLng != null
    const hasAnswer = this.answerLat != null && this.answerLng != null

    if (hasAnswer) {
      L.marker([this.answerLat, this.answerLng], { icon: answerIcon })
        .addTo(this._map)
        .bindPopup('Answer')
    }

    if (hasGuess && hasAnswer) {
      L.marker([this.guessLat, this.guessLng])
        .addTo(this._map)
        .bindPopup('Your guess')

      L.polyline(
        [[this.guessLat, this.guessLng], [this.answerLat, this.answerLng]],
        { color: '#ac1b11', weight: 2, dashArray: '8, 8', opacity: 0.7 }
      ).addTo(this._map)

      const bounds = L.latLngBounds(
        [this.guessLat, this.guessLng],
        [this.answerLat, this.answerLng]
      )
      this._map.fitBounds(bounds, { padding: [40, 40], maxZoom: 12 })
    } else if (hasAnswer) {
      this._map.setView([this.answerLat, this.answerLng], 5)
    } else {
      this._map.setView([20, 0], 2)
    }
  }

  _toggleLabels () {
    if (!this._map) return
    const zoom = this._map.getZoom()
    const show = zoom >= 3
    this.renderRoot.querySelectorAll('.country-label').forEach(el => {
      el.style.display = show ? '' : 'none'
    })
  }

  _close () {
    this.visible = false
    if (this._map) {
      this._map.remove()
      this._map = null
    }
    this.dispatchEvent(new CustomEvent('score-closed', { bubbles: true, composed: true }))
  }

  render () {
    const scoreClass = this.score >= 4000 ? 'result-map__score--great'
      : this.score >= 2000 ? 'result-map__score--ok'
        : 'result-map__score--poor'

    const hasGuess = this.guessLat != null

    return html`
      <div class="result-map" data-cy="result-map" role="alert">
        <div class="result-map__header">
          <div class="result-map__score ${scoreClass}">+${this.score} pts</div>
          ${hasGuess ? html`
            <div class="result-map__distance">${formatDistance(this.distanceKm)} away</div>
          ` : html`
            <div class="result-map__distance">No guess</div>
          `}
          <div class="result-map__motivation">${getMotivation(this.score)}</div>
          ${this.waitingForHost ? html`
            <div class="result-map__waiting" data-cy="waiting-for-host">
              Waiting for host...
            </div>
          ` : ''}
          <button
            class="result-map__close"
            aria-label="Close"
            @click=${this._close}
          >&times;</button>
        </div>
        <div class="result-map__container"></div>
      </div>
    `
  }
}

customElements.define('result-map', ResultMap)
