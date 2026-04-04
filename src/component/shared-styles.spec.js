import { describe, it, expect } from 'vitest'
import { buttonStyles, inputStyles } from './shared-styles.js'

describe('shared-styles', () => {
  it('exports buttonStyles as a CSSResult', () => {
    expect(buttonStyles).toBeTruthy()
    expect(buttonStyles.cssText).toBeDefined()
    expect(buttonStyles.cssText).toContain('button')
  })

  it('exports inputStyles as a CSSResult', () => {
    expect(inputStyles).toBeTruthy()
    expect(inputStyles.cssText).toBeDefined()
    expect(inputStyles.cssText).toContain('input')
  })

  it('buttonStyles contains disabled state', () => {
    expect(buttonStyles.cssText).toContain('disabled')
  })

  it('buttonStyles contains brand color variable', () => {
    expect(buttonStyles.cssText).toContain('--brand')
  })

  it('inputStyles contains focus state', () => {
    expect(inputStyles.cssText).toContain('focus')
  })

  it('inputStyles contains aria-invalid styling', () => {
    expect(inputStyles.cssText).toContain('aria-invalid')
  })
})
