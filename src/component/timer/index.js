import { LitElement, html, css } from 'lit'
import { formatTime } from '../../data/timer'

export class RoundTimer extends LitElement {
  static properties = {
    startedAt: { type: Number },
    duration: { type: Number },
    _timeRemaining: { state: true },
    _done: { state: true }
  }

  static styles = css`
    :host { display: contents; }

    .round-info {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 40px;
      background: #fafafa;
      border-bottom: 1px solid var(--borderColor, rgb(0 0 0 / 15%));
      flex-shrink: 0;
    }

    .round-info__round {
      font-size: 0.85rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .round-info__timer {
      font-size: 1.6rem;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
      letter-spacing: 0.02em;
      padding: 4px 12px;
      background: #111;
      color: #fff;
      border-radius: 4px;
    }

    .round-info__timer--urgent {
      background: var(--color-error, #ac1b11);
      color: #fff;
      animation: timerPulse 1s infinite;
    }

    @keyframes timerPulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }

    .round-info--urgent {
      border-bottom-color: var(--color-error, #ac1b11);
      border-bottom-width: 2px;
    }

    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }

    @media (max-width: 900px) {
      .round-info { padding: 10px 24px; }
    }
  `

  constructor () {
    super()
    this.startedAt = 0
    this.duration = 30
    this._timeRemaining = this.duration
    this._done = false
    this._interval = null
  }

  connectedCallback () {
    super.connectedCallback()
    if (this.startedAt > 0) this._startTicking()
  }

  disconnectedCallback () {
    super.disconnectedCallback()
    this._stopTicking()
  }

  updated (changed) {
    if (changed.has('startedAt') || changed.has('duration')) {
      this._done = false
      this._startTicking()
    }
  }

  _startTicking () {
    this._stopTicking()
    if (!this.startedAt) return

    const tick = () => {
      const prev = Math.ceil(this._timeRemaining)
      const elapsed = (Date.now() - this.startedAt) / 1000
      this._timeRemaining = Math.max(0, this.duration - elapsed)
      const curr = Math.ceil(this._timeRemaining)

      if (curr !== prev && (curr === 10 || curr === 5 || curr === 0)) {
        this._announceTime(curr)
      }

      if (this._timeRemaining <= 0) {
        this._stopTicking()
        this.dispatchEvent(new CustomEvent('timer-expired', { bubbles: true, composed: true }))
      }
    }

    tick()
    this._interval = setInterval(tick, 250)
  }

  _stopTicking () {
    if (this._interval) {
      clearInterval(this._interval)
      this._interval = null
    }
  }

  stop () {
    this._stopTicking()
  }

  setDone () {
    this._stopTicking()
    this._done = true
  }

  _announceTime (seconds) {
    const liveRegion = this.renderRoot.querySelector('[data-sr-timer]')
    if (liveRegion) {
      liveRegion.textContent = seconds === 0 ? 'Time is up' : `${seconds} seconds remaining`
    }
  }

  render () {
    const isUrgent = this._timeRemaining <= 5 && this._timeRemaining > 0
    const display = this._done ? 'DONE' : formatTime(Math.ceil(this._timeRemaining))

    return html`
      <div class="round-info ${isUrgent ? 'round-info--urgent' : ''}" id="js-round-info">
        <span class="round-info__round"><slot></slot></span>
        <span
          class="round-info__timer ${isUrgent ? 'round-info__timer--urgent' : ''}"
          data-cy="timer"
          aria-hidden="true"
        >${isUrgent ? 'Hurry! ' : ''}${display}</span>
        <span class="sr-only" aria-live="polite" data-sr-timer></span>
      </div>
    `
  }
}

customElements.define('round-timer', RoundTimer)
