import { describe, it, expect } from 'vitest'
import { continents, getFlagUrl, getCountryByCode } from './countries'

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
    it('should return flagcdn URL with lowercase code', () => {
      expect(getFlagUrl('US')).toBe('https://flagcdn.com/w40/us.png')
    })

    it('should handle lowercase input', () => {
      expect(getFlagUrl('gb')).toBe('https://flagcdn.com/w40/gb.png')
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
