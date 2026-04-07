import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock Leaflet to avoid DOM measurement issues in jsdom
const mockMap = {
  remove: vi.fn(),
  setView: vi.fn(),
  fitBounds: vi.fn(),
  on: vi.fn(),
  getZoom: vi.fn(() => 2)
}

const mockGeoJSON = { addTo: vi.fn(() => ({ bringToBack: vi.fn() })) }
const mockMarker = { addTo: vi.fn(() => ({ bindPopup: vi.fn(() => ({})) })) }
const mockPolyline = { addTo: vi.fn(() => ({})) }

vi.mock('leaflet', () => ({
  default: {
    map: vi.fn(() => mockMap),
    geoJSON: vi.fn(() => mockGeoJSON),
    marker: vi.fn(() => mockMarker),
    polyline: vi.fn(() => mockPolyline),
    latLngBounds: vi.fn(() => ({})),
    icon: vi.fn(() => ({})),
    Icon: { Default: { prototype: { _getIconUrl: null }, mergeOptions: vi.fn() } }
  }
}))

// Stub fetch for geojson
globalThis.fetch = vi.fn(() =>
  Promise.resolve({ json: () => Promise.resolve({ type: 'FeatureCollection', features: [] }) })
)

const { ResultMap } = await import('./index.js')

describe('ResultMap', () => {
  let el

  beforeEach(() => {
    vi.clearAllMocks()
    el = document.createElement('result-map')
    document.body.appendChild(el)
  })

  afterEach(() => {
    el.remove()
  })

  it('is registered as a custom element', () => {
    expect(customElements.get('result-map')).toBe(ResultMap)
  })

  it('has correct default property values', () => {
    expect(el.guessLat).toBeNull()
    expect(el.guessLng).toBeNull()
    expect(el.answerLat).toBeNull()
    expect(el.answerLng).toBeNull()
    expect(el.distanceKm).toBeNull()
    expect(el.score).toBe(0)
    expect(el.visible).toBe(false)
    expect(el.waitingForHost).toBe(false)
  })

  // ── formatDistance ─────────────────────────────────────────

  describe('formatDistance (via render)', () => {
    it('shows distance in meters for < 1km', async () => {
      el.score = 4999
      el.guessLat = 10
      el.guessLng = 20
      el.distanceKm = 0.5
      await el.updateComplete

      const dist = el.renderRoot.querySelector('.result-map__distance')
      expect(dist.textContent).toContain('500 m')
    })

    it('shows distance in km with 1 decimal for < 100km', async () => {
      el.score = 4000
      el.guessLat = 10
      el.guessLng = 20
      el.distanceKm = 45.7
      await el.updateComplete

      const dist = el.renderRoot.querySelector('.result-map__distance')
      expect(dist.textContent).toContain('45.7 km')
    })

    it('shows rounded distance for >= 100km', async () => {
      el.score = 2000
      el.guessLat = 10
      el.guessLng = 20
      el.distanceKm = 1234.5
      await el.updateComplete

      const dist = el.renderRoot.querySelector('.result-map__distance')
      expect(dist.textContent).toContain('1,235 km')
    })

    it('shows "No guess" when no guess coordinates', async () => {
      el.score = 0
      el.guessLat = null
      await el.updateComplete

      const dist = el.renderRoot.querySelector('.result-map__distance')
      expect(dist.textContent).toContain('No guess')
    })
  })

  // ── getMotivation (via render) ────────────────────────────

  describe('getMotivation (via render)', () => {
    const cases = [
      [5000, 'Perfect!'],
      [4900, 'Incredible!'],
      [4500, 'Amazing!'],
      [4000, 'Great guess!'],
      [3000, 'Not bad!'],
      [2000, 'Could be better'],
      [1000, 'Keep trying!'],
      [500, 'Way off...'],
      [0, 'Better luck next time!']
    ]

    for (const [score, expected] of cases) {
      it(`shows "${expected}" for score ${score}`, async () => {
        el.score = score
        el.guessLat = 10
        el.guessLng = 20
        await el.updateComplete

        const motivation = el.renderRoot.querySelector('.result-map__motivation')
        expect(motivation.textContent).toBe(expected)
      })
    }
  })

  // ── Score color classes ────────────────────────────────────

  describe('score color classes', () => {
    it('uses great class for score >= 4000', async () => {
      el.score = 4500
      await el.updateComplete
      const scoreEl = el.renderRoot.querySelector('.result-map__score')
      expect(scoreEl.classList.contains('result-map__score--great')).toBe(true)
    })

    it('uses ok class for score >= 2000 and < 4000', async () => {
      el.score = 2500
      await el.updateComplete
      const scoreEl = el.renderRoot.querySelector('.result-map__score')
      expect(scoreEl.classList.contains('result-map__score--ok')).toBe(true)
    })

    it('uses poor class for score < 2000', async () => {
      el.score = 500
      await el.updateComplete
      const scoreEl = el.renderRoot.querySelector('.result-map__score')
      expect(scoreEl.classList.contains('result-map__score--poor')).toBe(true)
    })
  })

  // ── Close behavior ─────────────────────────────────────────

  describe('close', () => {
    it('dispatches score-closed event', async () => {
      const handler = vi.fn()
      el.addEventListener('score-closed', handler)

      el.visible = true
      await el.updateComplete

      el._close()
      expect(el.visible).toBe(false)
      expect(handler).toHaveBeenCalled()
    })
  })

  // ── Waiting for host ──────────────────────────────────────

  describe('waiting for host indicator', () => {
    it('shows waiting indicator when waitingForHost is true', async () => {
      el.waitingForHost = true
      await el.updateComplete

      const waiting = el.renderRoot.querySelector('[data-cy="waiting-for-host"]')
      expect(waiting).toBeTruthy()
      expect(waiting.textContent).toContain('Waiting for host')
    })

    it('hides waiting indicator when waitingForHost is false', async () => {
      el.waitingForHost = false
      await el.updateComplete

      const waiting = el.renderRoot.querySelector('[data-cy="waiting-for-host"]')
      expect(waiting).toBeNull()
    })
  })

  // ── Accessibility ──────────────────────────────────────────

  describe('accessibility', () => {
    it('has role=alert on result container', async () => {
      await el.updateComplete
      const container = el.renderRoot.querySelector('[data-cy="result-map"]')
      expect(container.getAttribute('role')).toBe('alert')
    })

    it('has aria-label on map container', async () => {
      await el.updateComplete
      const mapContainer = el.renderRoot.querySelector('.result-map__container')
      expect(mapContainer.getAttribute('aria-label')).toBeTruthy()
    })

    it('close button has aria-label', async () => {
      await el.updateComplete
      const closeBtn = el.renderRoot.querySelector('.result-map__close')
      expect(closeBtn.getAttribute('aria-label')).toBe('Close')
    })
  })

  // ── Score display ──────────────────────────────────────────

  describe('score display', () => {
    it('shows points value', async () => {
      el.score = 3500
      await el.updateComplete
      const scoreEl = el.renderRoot.querySelector('.result-map__score')
      expect(scoreEl.textContent).toContain('+3500 pts')
    })
  })
})
