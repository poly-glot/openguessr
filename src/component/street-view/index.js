import { LitElement, html, css } from 'lit'

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''

let mapsSdkPromise = null

function bootstrapMapsLoader () {
  if (window.google?.maps?.importLibrary) return
  // Google's official inline bootstrap loader (sets up google.maps.importLibrary)
  ;((g) => {
    let h; const a = 'The Google Maps JavaScript API'; const c = 'google'; const l = 'importLibrary'; const q = '__ib__'
    const m = document; let b = window
    b = b[c] || (b[c] = {})
    const d = b.maps || (b.maps = {}); const r = new Set(); const e = new URLSearchParams()
    const u = () => h || (h = new Promise((f, n) => {
      const scr = m.createElement('script')
      e.set('libraries', [...r] + '')
      for (const k in g) e.set(k.replace(/[A-Z]/g, t => '_' + t[0].toLowerCase()), g[k])
      e.set('callback', c + '.maps.' + q)
      scr.src = `https://maps.${c}apis.com/maps/api/js?` + e
      d[q] = f
      scr.onerror = () => { h = null; n(Error(a + ' could not load.')) }
      scr.nonce = m.querySelector('script[nonce]')?.nonce || ''
      m.head.append(scr)
    }))
    d[l] ? console.warn(a + ' only loads once. Ignoring:', g) : (d[l] = (f, ...n) => r.add(f) && u().then(() => d[l](f, ...n)))
  })({ key: GOOGLE_MAPS_API_KEY, v: 'weekly' })
}

function loadMapsSdk () {
  if (mapsSdkPromise) return mapsSdkPromise
  bootstrapMapsLoader()
  mapsSdkPromise = window.google.maps.importLibrary('streetView').then(({ StreetViewPanorama }) => {
    return { ...window.google.maps, StreetViewPanorama }
  })
  return mapsSdkPromise
}

export class StreetViewPanel extends LitElement {
  static properties = {
    lat: { type: Number },
    lng: { type: Number },
    status: { type: String },
    playerCount: { type: Number },
    playerNames: { type: String }
  }

  static styles = css`
    :host {
      position: relative;
      flex: 1;
      min-height: 0;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .street-view {
      width: 100%;
      min-height: 0;
      position: relative;
      background: #f0f0f0;
      border-bottom: 1px solid var(--borderColor, rgb(0 0 0 / 15%));
      flex: 1;
    }

    .street-view__placeholder {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      position: absolute;
      inset: 0;
      color: #888;
      gap: 16px;
    }

    .street-view__placeholder p {
      font-size: 0.9rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .street-view__panorama {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
    }

    .lobby-info {
      text-align: center;
      margin-top: 8px;
    }

    .lobby-info__count {
      font-size: 0.85rem;
      font-weight: 600;
      color: #555;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .lobby-info__names {
      font-size: 0.78rem;
      color: #888;
      margin-top: 4px;
    }

    .street-view__hint {
      position: absolute;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0, 0, 0, 0.7);
      color: #fff;
      padding: 8px 16px;
      border-radius: 20px;
      font-size: 0.78rem;
      font-weight: 500;
      pointer-events: none;
      z-index: 5;
      animation: hintFadeOut 3s ease-out forwards;
    }

    @keyframes hintFadeOut {
      0%, 70% { opacity: 1; }
      100% { opacity: 0; }
    }

    /* Confetti canvas overlay */
    .confetti-canvas {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 20;
    }

    /* Wrong guess red flash overlay */
    .wrong-flash {
      position: absolute;
      inset: 0;
      background: rgba(172, 27, 17, 0.15);
      pointer-events: none;
      z-index: 15;
      animation: wrongFlash 0.8s ease-out forwards;
    }

    @keyframes wrongFlash {
      0% { opacity: 1; }
      100% { opacity: 0; }
    }
  `

  constructor () {
    super()
    this.lat = null
    this.lng = null
    this.status = 'loading'
    this.playerCount = 0
    this.playerNames = ''
    this._hintShown = false
    this._animationFrameId = null
    this._panorama = null
  }

  disconnectedCallback () {
    super.disconnectedCallback()
    if (this._animationFrameId) {
      cancelAnimationFrame(this._animationFrameId)
      this._animationFrameId = null
    }
    this._panorama = null
  }

  updated (changed) {
    if ((changed.has('lat') || changed.has('lng') || changed.has('status')) &&
        this.lat != null && this.lng != null &&
        this.status !== 'lobby' && this.status !== 'gameover') {
      this._mountPanorama()
    }
  }

  async _mountPanorama () {
    const container = this.renderRoot.querySelector('.street-view__panorama')
    if (!container) return

    try {
      const maps = await loadMapsSdk()
      if (this._panorama) {
        this._panorama.setPosition({ lat: this.lat, lng: this.lng })
        this._panorama.setPov({ heading: 0, pitch: 0 })
      } else {
        this._panorama = new maps.StreetViewPanorama(container, {
          position: { lat: this.lat, lng: this.lng },
          pov: { heading: 0, pitch: 0 },
          zoom: 0,
          // Hide everything that reveals the location
          addressControl: false,
          linksControl: false,
          showRoadLabels: false,
          fullscreenControl: false,
          motionTracking: false,
          motionTrackingControl: false,
          enableCloseButton: false,
          // Keep pan and zoom for gameplay
          panControl: true,
          zoomControl: true
        })
      }
    } catch (err) {
      console.error('Street View panorama failed to load:', err)
    }
  }

  render () {
    if (this.status === 'lobby') return this._renderLobby()
    if (this.status === 'gameover') return this._renderGameOver()
    if (this.lat != null && this.lng != null) return this._renderStreetView()
    return this._renderLoading()
  }

  _renderLoading () {
    return html`
      <div class="street-view">
        <div class="street-view__placeholder">
          <img src="/assets/loading.gif" alt="Loading" width="40" height="40" />
          <p>Waiting for game to start...</p>
        </div>
        <slot></slot>
      </div>
    `
  }

  _renderLobby () {
    return html`
      <div class="street-view">
        <div class="street-view__placeholder">
          <img src="/assets/loading.gif" alt="Waiting" width="40" height="40" />
          <p>Waiting for host to start (${this.playerCount} player${this.playerCount !== 1 ? 's' : ''} ready)</p>
          <div class="lobby-info" data-cy="lobby-info">
            <div class="lobby-info__count">${this.playerCount} player${this.playerCount !== 1 ? 's' : ''} in lobby</div>
            <div class="lobby-info__names">${this.playerNames}</div>
          </div>
        </div>
        <slot></slot>
      </div>
    `
  }

  _renderStreetView () {
    const showHint = !this._hintShown
    if (showHint) this._hintShown = true

    return html`
      <div class="street-view">
        <div class="street-view__panorama" data-cy="street-view-panorama"></div>
        ${showHint ? html`<div class="street-view__hint">Drag to look around</div>` : ''}
        <slot></slot>
      </div>
    `
  }

  _renderGameOver () {
    return html`
      <div class="street-view">
        <slot name="gameover"></slot>
        <slot></slot>
      </div>
    `
  }

  showConfetti () {
    const container = this.renderRoot.querySelector('.street-view')
    if (!container) return

    const canvas = document.createElement('canvas')
    canvas.className = 'confetti-canvas'
    canvas.width = container.offsetWidth
    canvas.height = container.offsetHeight
    container.appendChild(canvas)

    const ctx = canvas.getContext('2d')
    const colors = ['#16a34a', '#2193b0', '#f9a825', '#e91e63', '#9c27b0', '#ff5722']
    const pieces = []

    for (let i = 0; i < 80; i++) {
      pieces.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height * -1,
        w: Math.random() * 8 + 4,
        h: Math.random() * 4 + 2,
        color: colors[Math.floor(Math.random() * colors.length)],
        vx: (Math.random() - 0.5) * 4,
        vy: Math.random() * 3 + 2,
        rot: Math.random() * Math.PI * 2,
        rotV: (Math.random() - 0.5) * 0.2
      })
    }

    let frame = 0
    const maxFrames = 120

    const animate = () => {
      frame++
      if (frame > maxFrames) { canvas.remove(); this._animationFrameId = null; return }
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.globalAlpha = frame > maxFrames - 30 ? (maxFrames - frame) / 30 : 1

      for (const p of pieces) {
        p.x += p.vx
        p.y += p.vy
        p.vy += 0.05
        p.rot += p.rotV
        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rot)
        ctx.fillStyle = p.color
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h)
        ctx.restore()
      }
      this._animationFrameId = requestAnimationFrame(animate)
    }
    this._animationFrameId = requestAnimationFrame(animate)
  }

  showWrongEffect () {
    const container = this.renderRoot.querySelector('.street-view')
    if (!container) return
    const flash = document.createElement('div')
    flash.className = 'wrong-flash'
    container.appendChild(flash)
    flash.addEventListener('animationend', () => flash.remove())
  }

  clearEffects () {
    const container = this.renderRoot.querySelector('.street-view')
    if (container) {
      container.querySelectorAll('.confetti-canvas, .wrong-flash').forEach(el => el.remove())
    }
  }
}

customElements.define('street-view-panel', StreetViewPanel)
