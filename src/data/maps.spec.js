import { describe, it, expect } from 'vitest'
import { createGoogleMapsUrl } from './maps'

describe('maps utilities', () => {
  describe('createGoogleMapsUrl', () => {
    it('should build correct maps URL', () => {
      const url = createGoogleMapsUrl(48.8566, 2.3522)
      expect(url).toBe('https://www.google.com/maps?q=48.8566,2.3522')
    })
  })
})
