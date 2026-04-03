import { formatTime } from '../../data/timer'

export class TimerController {
  constructor () {
    this._interval = null
    this.timeRemaining = 0
    this.onExpired = null
  }

  start (startedAt, duration) {
    this.stop()

    const el = document.getElementById('js-timer')
    if (!el) return

    const tick = () => {
      const elapsed = (Date.now() - startedAt) / 1000
      this.timeRemaining = Math.max(0, duration - elapsed)

      el.textContent = formatTime(Math.ceil(this.timeRemaining))

      if (this.timeRemaining <= 5) {
        el.classList.add('round-info__timer--urgent')
      } else {
        el.classList.remove('round-info__timer--urgent')
      }

      if (this.timeRemaining <= 0) {
        this.stop()
        if (this.onExpired) this.onExpired()
      }
    }

    tick()
    this._interval = setInterval(tick, 250)
  }

  stop () {
    if (this._interval) {
      clearInterval(this._interval)
      this._interval = null
    }
    const el = document.getElementById('js-timer')
    if (el) el.classList.remove('round-info__timer--urgent')
  }

  setDone () {
    const el = document.getElementById('js-timer')
    if (el) el.textContent = 'DONE'
  }
}
