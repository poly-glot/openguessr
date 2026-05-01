import { describe, it, expect } from 'vitest'
import { continents, getFlagUrl, getCountryByCode, getAllCountriesSorted, FLAG_SPRITE_URL } from './countries'

describe('countries data', () => {
  describe('continents', () => {
    it('should have 6 continents', () => {
      const names = Object.keys(continents)
      expect(names).toHaveLength(6)
      expect(names).toEqual([
        'North America', 'South America', 'Europe', 'Asia', 'Africa', 'Oceania'
      ])
    })

    it('every country should have a code and name', () => {
      for (const [continent, countries] of Object.entries(continents)) {
        for (const country of countries) {
          expect(country.code, `${continent}: missing code`).toBeTruthy()
          expect(country.name, `${continent}/${country.code}: missing name`).toBeTruthy()
          expect(country.code).toMatch(/^[A-Z]{2}$/)
        }
      }
    })

    it('country codes should be unique across all continents', () => {
      const allCodes = Object.values(continents).flat().map(c => c.code)
      const unique = new Set(allCodes)
      expect(unique.size).toBe(allCodes.length)
    })
  })

  describe('getFlagUrl', () => {
    it('points at the bundled sprite with a lowercase symbol id', () => {
      expect(getFlagUrl('US')).toBe(`${FLAG_SPRITE_URL}#flag-us`)
    })

    it('handles lowercase input', () => {
      expect(getFlagUrl('gb')).toBe(`${FLAG_SPRITE_URL}#flag-gb`)
    })

    it('exposes the sprite URL as a local app asset (no external CDN)', () => {
      expect(FLAG_SPRITE_URL.startsWith('/')).toBe(true)
      expect(FLAG_SPRITE_URL).not.toMatch(/^https?:/)
    })
  })

  describe('getAllCountriesSorted', () => {
    it('returns every country flat and alphabetical', () => {
      const all = getAllCountriesSorted()
      const totalFromContinents = Object.values(continents).flat().length
      expect(all).toHaveLength(totalFromContinents)
      const names = all.map(c => c.name)
      const sorted = [...names].sort((a, b) => a.localeCompare(b))
      expect(names).toEqual(sorted)
    })

    it('annotates every country with its continent', () => {
      const all = getAllCountriesSorted()
      for (const c of all) {
        expect(c.continent, `${c.code} missing continent`).toBeTruthy()
      }
    })
  })

  describe('getCountryByCode', () => {
    it('should find a known country', () => {
      const result = getCountryByCode('US')
      expect(result).toEqual({
        code: 'US',
        name: 'United States',
        continent: 'North America'
      })
    })

    it('should find country from different continent', () => {
      const result = getCountryByCode('JP')
      expect(result).toEqual({
        code: 'JP',
        name: 'Japan',
        continent: 'Asia'
      })
    })

    it('should return null for unknown code', () => {
      expect(getCountryByCode('XX')).toBeNull()
    })

    it('should return null for empty string', () => {
      expect(getCountryByCode('')).toBeNull()
    })
  })
})
