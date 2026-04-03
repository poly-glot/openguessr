import { getAuth } from 'firebase/auth'
import database from '../database'
import AlertService from '../../component/alert/alert'
import { showLanding } from '../../component/landing'

export class AuthDialog {
  toggleVisibilityBasedOnAuth (user) {
    if (!user) {
      const hasRoomId = new URLSearchParams(window.location.search).has('roomId')
      if (hasRoomId) {
        this.show()
      } else {
        showLanding()
      }
    } else {
      this.hide()
    }
  }

  show = () => {
    if (this.isDisplayed()) return

    const template = document.getElementById('dialogs')
    const dialog = template.content.querySelector('#authDialog').cloneNode(true)
    dialog.removeAttribute('id')
    dialog.classList.add('auth-dialog')

    const form = dialog.querySelector('form')
    form.addEventListener('submit', this.onFormSubmit)

    const closeBtn = dialog.querySelector('.dialog__close')
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        this.hide()
        showLanding()
      })
    }

    document.body.appendChild(dialog)
    dialog.showModal()
  }

  hide = () => {
    this.loginDialog?.remove()
  }

  onFormSubmit = async (evt) => {
    evt.preventDefault()

    const { target: form } = evt
    const submit = form.querySelector('button[type=submit]')
    const { value } = form.querySelector('[name=username]')

    this.setError(false)
    submit.disabled = true

    if (!value || value.trim().length === 0 || value.length > 32) {
      this.setError('Invalid username supplied')
      return
    }

    try {
      await database.signIn(value.trim())
      AlertService.announce('You are logged in')
    } catch (err) {
      const errorMessage = err.message || err.toString()
      if (errorMessage.includes('internal') || errorMessage.includes('INTERNAL')) {
        this.setError('Unable to connect. Please try again later.')
      } else {
        this.setError(errorMessage)
      }
    }
  }

  setError (errorMsg) {
    const dialog = this.loginDialog
    if (!dialog) return

    const form = dialog.querySelector('form')
    const submit = form.querySelector('button[type=submit]')
    const username = form.querySelector('[name=username]')
    const error = form.querySelector('.form__error')

    if (errorMsg) {
      username.setAttribute('aria-invalid', 'true')
      error.textContent = errorMsg
      submit.disabled = false
      username.focus()
    } else {
      username.removeAttribute('aria-invalid')
      error.textContent = ''
    }
  }

  isDisplayed () {
    return !!this.loginDialog
  }

  get loginDialog () {
    return document.querySelector('.auth-dialog')
  }
}

const authDialog = new AuthDialog()

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
