import { describe, it, expect } from 'vitest'
import { createStreetViewUrl, createGoogleMapsUrl } from './maps'

describe('maps utilities', () => {
  describe('createStreetViewUrl', () => {
    it('should build correct embed URL', () => {
      const url = createStreetViewUrl(48.8566, 2.3522, 'TEST_KEY')
      expect(url).toBe(
        'https://www.google.com/maps/embed/v1/streetview?key=TEST_KEY&location=48.8566,2.3522&fov=90'
      )
    })

    it('should use custom fov', () => {
      const url = createStreetViewUrl(0, 0, 'KEY', 120)
      expect(url).toContain('&fov=120')
    })

    it('should handle negative coordinates', () => {
      const url = createStreetViewUrl(-33.8688, 151.2093, 'KEY')
      expect(url).toContain('location=-33.8688,151.2093')
    })
  })

  describe('createGoogleMapsUrl', () => {
    it('should build correct maps URL', () => {
      const url = createGoogleMapsUrl(48.8566, 2.3522)
      expect(url).toBe('https://www.google.com/maps?q=48.8566,2.3522')
    })
  })
})
