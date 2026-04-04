import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('Landing', () => {
  let initLanding, showLanding, isLandingVisible

  beforeEach(async () => {
    // Re-import each time for clean module state
    const mod = await import('./index.js')
    initLanding = mod.initLanding
    showLanding = mod.showLanding
    isLandingVisible = mod.isLandingVisible
  })

  function getLanding () {
    return document.getElementById('landing-page')
  }

  function getApp () {
    return document.getElementById('app-view')
  }

  describe('initLanding', () => {
    it('shows app and hides landing when roomId present', () => {
      const url = new URL(window.location.href)
      url.searchParams.set('roomId', 'test-room')
      window.history.replaceState(null, '', url.toString())

      initLanding()
      expect(getLanding().hidden).toBe(true)
      expect(getApp().hidden).toBe(false)

      url.searchParams.delete('roomId')
      window.history.replaceState(null, '', url.toString())
    })

    it('shows landing and hides app when no roomId', () => {
      const url = new URL(window.location.href)
      url.searchParams.delete('roomId')
      window.history.replaceState(null, '', url.toString())

      initLanding()
      expect(getLanding().hidden).toBe(false)
      expect(getApp().hidden).toBe(true)
    })

    it('returns early when landing element is missing', () => {
      const landing = getLanding()
      const parent = landing.parentNode
      landing.remove()

      // Should not throw
      initLanding()

      // Restore
      parent.insertBefore(landing, getApp())
    })

    it('clicking start-game button hides landing and shows app', () => {
      const url = new URL(window.location.href)
      url.searchParams.delete('roomId')
      window.history.replaceState(null, '', url.toString())

      initLanding()

      const handler = vi.fn()
      document.addEventListener('landing:start-game', handler)

      const btn = document.querySelector('[data-action="start-game"]')
      btn.click()

      expect(getLanding().hidden).toBe(true)
      expect(getApp().hidden).toBe(false)
      expect(handler).toHaveBeenCalledTimes(1)

      document.removeEventListener('landing:start-game', handler)
    })
  })

  describe('showLanding', () => {
    it('shows landing and hides app', () => {
      getLanding().hidden = true
      getApp().hidden = false
      showLanding()
      expect(getLanding().hidden).toBe(false)
      expect(getApp().hidden).toBe(true)
    })

    it('removes roomId from URL', () => {
      const url = new URL(window.location.href)
      url.searchParams.set('roomId', 'test')
      window.history.replaceState(null, '', url.toString())

      showLanding()

      const newUrl = new URL(window.location.href)
      expect(newUrl.searchParams.has('roomId')).toBe(false)
    })
  })

  describe('isLandingVisible', () => {
    it('returns true when landing is visible', () => {
      getLanding().hidden = false
      expect(isLandingVisible()).toBe(true)
    })

    it('returns false when landing is hidden', () => {
      getLanding().hidden = true
      expect(isLandingVisible()).toBe(false)
    })
  })
})
