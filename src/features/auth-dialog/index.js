import { getAuth } from 'firebase/auth'
import database from '../database'
import AlertService from '../../component/alert/alert'
import { showLanding } from '../../component/landing'

const dialogStyles = `
  .auth-dialog:not([open]) {
    display: none;
  }

  .auth-dialog {
    background: #fff;
    border: 1px solid rgb(0 0 0 / 10%);
    box-shadow: rgb(1 1 1 / 25%) 0 0 6px;
    display: flex;
    flex-direction: column;
    max-width: 600px;
    min-height: 300px;
    padding: 0;
    width: 100%;
  }

  .auth-dialog::backdrop {
    backdrop-filter: blur(3px);
    background-color: rgb(0 0 0 / 50%);
  }

  .auth-dialog .dialog__header {
    display: flex;
    justify-content: space-between;
    margin: 15px;
  }

  .auth-dialog .dialog__title {
    font-size: 1.2rem;
    font-weight: 700;
    text-transform: uppercase;
    margin: 0;
  }

  .auth-dialog .dialog__tagline {
    font-size: 0.82rem;
    color: #888;
    margin: 4px 0 0;
    font-weight: normal;
  }

  .auth-dialog .dialog__close {
    background: transparent;
    border: none;
    color: #000;
    cursor: pointer;
    font-size: 1.1rem;
    height: 25px;
    line-height: 25px;
    min-width: 25px;
    padding: 5px;
    width: 25px;
  }

  .auth-dialog .dialog__close:hover,
  .auth-dialog .dialog__close:focus { background-color: transparent; opacity: 0.5; }

  .auth-dialog .dialog__content {
    display: flex;
    flex: 1;
    flex-direction: column;
    margin: 15px;
  }

  .auth-dialog .dialog__instructions {
    display: flex;
    flex: 1;
    flex-direction: column;
  }

  .auth-dialog .dialog__submit { margin-top: 20px; }
`

class AuthDialogController {
  constructor () {
    this._dialog = null
    this._styleInjected = false
    this._triggerElement = null
  }

  _injectStyles () {
    if (this._styleInjected) return
    this._styleInjected = true
    const style = document.createElement('style')
    style.textContent = dialogStyles
    document.head.appendChild(style)
  }

  _createDialog () {
    if (this._dialog) return this._dialog

    this._injectStyles()

    const dialog = document.createElement('dialog')
    dialog.className = 'auth-dialog'

    dialog.innerHTML = `
      <header class="dialog__header">
        <div>
          <h1 class="dialog__title">OpenGuessr</h1>
          <p class="dialog__tagline">Guess the country. Challenge your friends.</p>
        </div>
        <button type="button" class="dialog__close" data-cy="dialog-close" aria-label="Close">&#x2715;</button>
      </header>
      <form class="form dialog__content">
        <div class="dialog__instructions">
          <div class="form__entry">
            <label class="form__label" for="username">What shall we call you?</label>
            <input class="form__input" id="username" name="username" data-cy="username" type="text" maxlength="32" autocomplete="off" />
            <div class="form__error" role="alert"></div>
          </div>
        </div>
        <div class="dialog__submit">
          <button type="submit" data-cy="submit">PLAY</button>
        </div>
      </form>
    `

    const closeBtn = dialog.querySelector('.dialog__close')
    closeBtn.addEventListener('click', () => {
      this.hide()
      showLanding()
    })

    const form = dialog.querySelector('form')
    form.addEventListener('submit', (e) => this._onSubmit(e))

    document.body.appendChild(dialog)
    this._dialog = dialog
    return dialog
  }

  toggleVisibilityBasedOnAuth (user) {
    if (!user) {
      const hasRoomId = new URLSearchParams(window.location.search).has('roomId')
      if (hasRoomId) {
        this.show()
        this._setSessionExpiredHint()
      } else {
        showLanding()
      }
    } else {
      this.hide()
    }
  }

  _setSessionExpiredHint () {
    if (!this._dialog) return
    const label = this._dialog.querySelector('.form__label')
    if (label && !label.dataset.hinted) {
      label.textContent = 'Session expired — enter your name to rejoin'
      label.dataset.hinted = 'true'
    }
  }

  show () {
    this._triggerElement = document.activeElement
    const dialog = this._createDialog()
    if (!dialog.open) {
      this._clearError()
      const submit = dialog.querySelector('button[type=submit]')
      if (submit) { submit.disabled = false; submit.textContent = 'PLAY' }
      dialog.showModal()
      const input = dialog.querySelector('[name=username]')
      if (input) input.focus()
    }
  }

  hide () {
    if (this._dialog?.open) {
      this._dialog.close()
    }
    if (this._triggerElement && typeof this._triggerElement.focus === 'function') {
      this._triggerElement.focus()
      this._triggerElement = null
    }
  }

  async _onSubmit (e) {
    e.preventDefault()
    const form = e.target
    const submit = form.querySelector('button[type=submit]')
    const input = form.querySelector('[name=username]')
    const value = input.value

    this._clearError()
    submit.disabled = true
    submit.textContent = 'Signing in...'

    if (!value || value.trim().length === 0 || value.length > 32) {
      this._setError('Invalid username supplied')
      submit.disabled = false
      submit.textContent = 'PLAY'
      return
    }

    try {
      await database.signIn(value.trim())
      AlertService.announce('You are logged in')
    } catch (err) {
      const errorMessage = err.message || err.toString()
      if (errorMessage.includes('internal') || errorMessage.includes('INTERNAL')) {
        this._setError('Unable to connect. Please try again later.')
      } else {
        this._setError(errorMessage)
      }
      submit.disabled = false
      submit.textContent = 'PLAY'
    }
  }

  _setError (msg) {
    if (!this._dialog) return
    const input = this._dialog.querySelector('[name=username]')
    const error = this._dialog.querySelector('.form__error')
    input.setAttribute('aria-invalid', 'true')
    error.textContent = msg
    input.focus()
  }

  _clearError () {
    if (!this._dialog) return
    const input = this._dialog.querySelector('[name=username]')
    const error = this._dialog.querySelector('.form__error')
    input.removeAttribute('aria-invalid')
    error.textContent = ''
  }
}

const authDialog = new AuthDialogController()

document.addEventListener('landing:start-game', async () => {
  const user = getAuth().currentUser
  if (user) {
    const { default: gameScreen } = await import('../game-screen')
    gameScreen.resumeJourney(user)
  } else {
    authDialog.show()
  }
})

export default authDialog
