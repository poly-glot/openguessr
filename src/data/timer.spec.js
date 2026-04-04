import { describe, it, expect } from 'vitest'
import { formatTime } from './timer'

describe('formatTime', () => {
  it('should format 0 seconds as 00:00', () => {
    expect(formatTime(0)).toBe('00:00')
  })

  it('should format 30 seconds', () => {
    expect(formatTime(30)).toBe('00:30')
  })

  it('should format 90 seconds as 01:30', () => {
    expect(formatTime(90)).toBe('01:30')
  })

  it('should format single digit seconds with leading zero', () => {
    expect(formatTime(5)).toBe('00:05')
  })

  it('should handle negative values as 00:00', () => {
    expect(formatTime(-5)).toBe('00:00')
  })

  it('should handle large values', () => {
    expect(formatTime(600)).toBe('10:00')
  })

  it('should floor fractional seconds', () => {
    expect(formatTime(5.9)).toBe('00:05')
  })
})
