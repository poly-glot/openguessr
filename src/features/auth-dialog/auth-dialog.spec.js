import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock firebase/auth before importing the module
vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({ currentUser: null }))
}))

// Mock database module
vi.mock('../database', () => ({
  default: {
    signIn: vi.fn()
  }
}))

// Mock alert service
vi.mock('../../component/alert/alert', () => ({
  default: {
    announce: vi.fn()
  }
}))

// Mock landing
vi.mock('../../component/landing', () => ({
  showLanding: vi.fn()
}))

// Mock game-screen
vi.mock('../game-screen', () => ({
  default: {
    resumeJourney: vi.fn()
  }
}))

describe('AuthDialogController', () => {
  let authDialog, database, AlertService, showLanding

  beforeEach(async () => {
    // Clear module cache for fresh imports
    const authModule = await import('./index.js')
    authDialog = authModule.default

    const dbModule = await import('../database')
    database = dbModule.default

    const alertModule = await import('../../component/alert/alert')
    AlertService = alertModule.default

    const landingModule = await import('../../component/landing')
    showLanding = landingModule.showLanding

    // Reset state
    if (authDialog._dialog) {
      authDialog._dialog.remove()
      authDialog._dialog = null
    }
    authDialog._styleInjected = false
  })

  afterEach(() => {
    // Clean up any dialogs
    document.querySelectorAll('.auth-dialog').forEach(d => d.remove())
    document.querySelectorAll('style').forEach(s => {
      if (s.textContent.includes('auth-dialog')) s.remove()
    })
    vi.clearAllMocks()
  })

  it('show() creates and opens dialog', () => {
    authDialog.show()
    expect(authDialog._dialog).toBeTruthy()
    expect(authDialog._dialog.open).toBe(true)
  })

  it('show() focuses username input', () => {
    authDialog.show()
    const input = authDialog._dialog.querySelector('[name=username]')
    expect(input).toBeTruthy()
    expect(document.activeElement === input || authDialog._dialog.contains(document.activeElement)).toBe(true)
  })

  it('show() does not reopen already open dialog', () => {
    authDialog.show()
    const dialog = authDialog._dialog
    authDialog.show()
    expect(authDialog._dialog).toBe(dialog)
  })

  it('hide() closes the dialog', () => {
    authDialog.show()
    expect(authDialog._dialog.open).toBe(true)
    authDialog.hide()
    expect(authDialog._dialog.open).toBe(false)
  })

  it('hide() does nothing when dialog is not open', () => {
    authDialog.hide()
    // Should not throw
  })

  it('_createDialog creates dialog structure', () => {
    authDialog.show()
    const dialog = authDialog._dialog
    expect(dialog.querySelector('.dialog__title').textContent).toBe('OpenGuessr')
    expect(dialog.querySelector('.dialog__tagline').textContent).toContain('Guess the country')
    expect(dialog.querySelector('[name=username]')).toBeTruthy()
    expect(dialog.querySelector('button[type=submit]').textContent).toBe('PLAY')
  })

  it('close button calls hide and showLanding', () => {
    authDialog.show()
    const closeBtn = authDialog._dialog.querySelector('[data-cy="dialog-close"]')
    closeBtn.click()
    expect(authDialog._dialog.open).toBe(false)
    expect(showLanding).toHaveBeenCalled()
  })

  it('_injectStyles only injects once', () => {
    authDialog._injectStyles()
    authDialog._injectStyles()
    const styles = document.querySelectorAll('style')
    const authStyles = [...styles].filter(s => s.textContent.includes('auth-dialog'))
    expect(authStyles.length).toBe(1)
  })

  it('form submission validates empty username', async () => {
    authDialog.show()
    const form = authDialog._dialog.querySelector('form')
    const input = authDialog._dialog.querySelector('[name=username]')
    input.value = ''

    const event = new Event('submit', { cancelable: true })
    await form.dispatchEvent(event)

    const error = authDialog._dialog.querySelector('.form__error')
    expect(error.textContent).toBe('Invalid username supplied')
    expect(input.getAttribute('aria-invalid')).toBe('true')
  })

  it('form submission validates whitespace-only username', async () => {
    authDialog.show()
    const form = authDialog._dialog.querySelector('form')
    const input = authDialog._dialog.querySelector('[name=username]')
    input.value = '   '

    const event = new Event('submit', { cancelable: true })
    await form.dispatchEvent(event)

    const error = authDialog._dialog.querySelector('.form__error')
    expect(error.textContent).toBe('Invalid username supplied')
  })

  it('form submission validates too-long username', async () => {
    authDialog.show()
    const form = authDialog._dialog.querySelector('form')
    const input = authDialog._dialog.querySelector('[name=username]')
    input.value = 'a'.repeat(33)

    const event = new Event('submit', { cancelable: true })
    await form.dispatchEvent(event)

    const error = authDialog._dialog.querySelector('.form__error')
    expect(error.textContent).toBe('Invalid username supplied')
  })

  it('form submission calls signIn on valid input', async () => {
    database.signIn.mockResolvedValue()
    authDialog.show()
    const form = authDialog._dialog.querySelector('form')
    const input = authDialog._dialog.querySelector('[name=username]')
    input.value = 'TestUser'

    const event = new Event('submit', { cancelable: true })
    await form.dispatchEvent(event)
    // Wait for async
    await vi.waitFor(() => {
      expect(database.signIn).toHaveBeenCalledWith('TestUser')
    })
    expect(AlertService.announce).toHaveBeenCalledWith('You are logged in')
  })

  it('form submission shows error on signIn failure', async () => {
    database.signIn.mockRejectedValue(new Error('Something failed'))
    authDialog.show()
    const form = authDialog._dialog.querySelector('form')
    const input = authDialog._dialog.querySelector('[name=username]')
    input.value = 'TestUser'

    const event = new Event('submit', { cancelable: true })
    await form.dispatchEvent(event)
    await vi.waitFor(() => {
      const error = authDialog._dialog.querySelector('.form__error')
      expect(error.textContent).toBe('Something failed')
    })
  })

  it('form submission shows generic message for internal errors', async () => {
    database.signIn.mockRejectedValue(new Error('INTERNAL server error'))
    authDialog.show()
    const form = authDialog._dialog.querySelector('form')
    const input = authDialog._dialog.querySelector('[name=username]')
    input.value = 'TestUser'

    const event = new Event('submit', { cancelable: true })
    await form.dispatchEvent(event)
    await vi.waitFor(() => {
      const error = authDialog._dialog.querySelector('.form__error')
      expect(error.textContent).toBe('Unable to connect. Please try again later.')
    })
  })

  it('_setError sets aria-invalid and error text', () => {
    authDialog.show()
    authDialog._setError('Test error')
    const input = authDialog._dialog.querySelector('[name=username]')
    const error = authDialog._dialog.querySelector('.form__error')
    expect(input.getAttribute('aria-invalid')).toBe('true')
    expect(error.textContent).toBe('Test error')
  })

  it('_clearError removes aria-invalid and clears error text', () => {
    authDialog.show()
    authDialog._setError('Test error')
    authDialog._clearError()
    const input = authDialog._dialog.querySelector('[name=username]')
    const error = authDialog._dialog.querySelector('.form__error')
    expect(input.hasAttribute('aria-invalid')).toBe(false)
    expect(error.textContent).toBe('')
  })

  it('_setError does nothing when no dialog', () => {
    authDialog._dialog = null
    authDialog._setError('test')
    // Should not throw
  })

  it('_clearError does nothing when no dialog', () => {
    authDialog._dialog = null
    authDialog._clearError()
    // Should not throw
  })

  it('toggleVisibilityBasedOnAuth shows dialog when no user and roomId exists', () => {
    const url = new URL(window.location.href)
    url.searchParams.set('roomId', 'test')
    window.history.replaceState(null, '', url.toString())

    const showSpy = vi.spyOn(authDialog, 'show')
    authDialog.toggleVisibilityBasedOnAuth(null)
    expect(showSpy).toHaveBeenCalled()
    showSpy.mockRestore()

    // Cleanup URL
    url.searchParams.delete('roomId')
    window.history.replaceState(null, '', url.toString())
  })

  it('toggleVisibilityBasedOnAuth shows landing when no user and no roomId', () => {
    const url = new URL(window.location.href)
    url.searchParams.delete('roomId')
    window.history.replaceState(null, '', url.toString())

    authDialog.toggleVisibilityBasedOnAuth(null)
    expect(showLanding).toHaveBeenCalled()
  })

  it('toggleVisibilityBasedOnAuth hides dialog when user exists', () => {
    authDialog.show()
    const hideSpy = vi.spyOn(authDialog, 'hide')
    authDialog.toggleVisibilityBasedOnAuth({ uid: 'test' })
    expect(hideSpy).toHaveBeenCalled()
    hideSpy.mockRestore()
  })

  it('show() clears previous errors and enables submit', () => {
    authDialog.show()
    authDialog._setError('Old error')
    const submit = authDialog._dialog.querySelector('button[type=submit]')
    submit.disabled = true

    authDialog.hide()
    authDialog.show()

    const error = authDialog._dialog.querySelector('.form__error')
    expect(error.textContent).toBe('')
    expect(submit.disabled).toBe(false)
  })
})
