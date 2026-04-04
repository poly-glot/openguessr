import { LitElement, html, css, unsafeCSS } from 'lit'
import { buttonStyles } from '../shared-styles'

const TIMER_CIRCUMFERENCE = 2 * Math.PI * 52

export class PromotionDialog extends LitElement {
  static properties = {
    data: { type: Object },
    currentUid: { type: String, attribute: 'current-uid' },
    _remaining: { state: true },
    _resolved: { state: true }
  }

  static styles = [buttonStyles, css`
    :host { display: block; }

    dialog {
      background: #fff;
      border: 1px solid rgb(0 0 0 / 10%);
      box-shadow: rgb(1 1 1 / 25%) 0 0 6px;
      display: flex;
      flex-direction: column;
      max-width: 440px;
      padding: 0;
      width: 100%;
      animation: dialogIn 0.25s ease both;
    }

    dialog::backdrop {
      backdrop-filter: blur(3px);
      background-color: rgb(0 0 0 / 50%);
      animation: backdropIn 0.25s ease both;
    }

    @keyframes dialogIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes backdropIn { from { opacity: 0; } to { opacity: 1; } }

    .dialog__header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin: 15px;
    }

    .dialog__title {
      font-size: 0.72rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #888;
      margin: 0;
    }

    .dialog__close {
      background: transparent !important;
      border: none !important;
      color: #000;
      cursor: pointer;
      font-size: 1.1rem;
      height: 25px;
      line-height: 25px;
      min-width: 25px !important;
      padding: 5px;
      width: 25px;
    }

    .dialog__close:hover { opacity: 0.5; }

    .dialog__content {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0;
      text-align: center;
      margin: 0 15px 15px;
    }

    .requester-line {
      font-size: 1.05rem;
      line-height: 1.6;
      color: #222;
      margin: 0 0 28px;
    }

    .requester-line strong { font-weight: 700; color: #111; }

    /* Circular Timer */
    .timer-ring {
      position: relative;
      width: 130px;
      height: 130px;
      margin: 0 auto 28px;
    }

    .timer-svg {
      width: 100%;
      height: 100%;
      transform: rotate(-90deg);
    }

    .timer-track {
      fill: none;
      stroke: rgb(0 0 0 / 8%);
      stroke-width: 5;
    }

    .timer-progress {
      fill: none;
      stroke: #2e7d5b;
      stroke-width: 5;
      stroke-linecap: round;
      stroke-dasharray: ${unsafeCSS(TIMER_CIRCUMFERENCE.toFixed(2))};
      stroke-dashoffset: 0;
      transition: stroke-dashoffset 1s linear, stroke 0.6s ease;
    }

    .timer-progress.warning { stroke: #c5930a; }
    .timer-progress.urgent { stroke: #ac1b11; }

    .timer-text {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }

    .timer-value {
      font-size: 2.4rem;
      font-weight: 700;
      letter-spacing: -0.03em;
      line-height: 1;
      color: #111;
    }

    .timer-value.warning { color: #9a7500; }
    .timer-value.urgent { color: #ac1b11; }

    .timer-label {
      font-size: 0.65rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: #888;
      margin-top: 4px;
    }

    /* Vote Stats */
    .stats {
      display: flex;
      justify-content: center;
      gap: 32px;
      margin-bottom: 24px;
      padding: 16px 0;
      border-top: 1px solid rgb(0 0 0 / 8%);
      border-bottom: 1px solid rgb(0 0 0 / 8%);
      width: 100%;
    }

    .stat {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
    }

    .stat__count {
      font-size: 1.4rem;
      font-weight: 700;
      line-height: 1;
      letter-spacing: -0.02em;
    }

    .stat__label {
      font-size: 0.65rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: #888;
    }

    .stat--approve .stat__count { color: #2e7d5b; }
    .stat--reject .stat__count { color: #ac1b11; }
    .stat--pending .stat__count { color: #888; }

    /* Vote List */
    .votes { margin-bottom: 20px; width: 100%; }

    .vote-entry {
      align-items: center;
      border-bottom: 1px solid rgb(0 0 0 / 6%);
      display: flex;
      justify-content: space-between;
      padding: 10px 0;
      animation: voteIn 0.3s ease both;
    }

    .vote-entry:last-child { border-bottom: none; }

    @keyframes voteIn {
      from { opacity: 0; transform: translateY(6px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .vote-name { font-weight: 600; font-size: 0.88rem; color: #222; }

    .vote-status {
      font-size: 0.72rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }

    .vote-status.approve { color: #2e7d5b; }
    .vote-status.reject { color: #ac1b11; }
    .vote-status.pending { color: #888; }

    /* Actions */
    .actions {
      display: flex;
      gap: 12px;
      justify-content: center;
      padding: 8px 0 0;
      width: 100%;
    }

    .actions button {
      min-width: 140px;
      min-height: 46px;
      font-size: 0.82rem;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      transition: background 0.2s, transform 0.15s;
    }

    .actions button:active:not([disabled]) { transform: scale(0.97); }

    .button-approve {
      background: #2e7d5b !important;
      border-color: #2e7d5b !important;
      color: #fff;
    }

    .button-approve:hover:not([disabled]),
    .button-approve:focus:not([disabled]) {
      background: #256b4c !important;
    }

    .button-reject {
      background: #ac1b11 !important;
      border-color: #ac1b11 !important;
      color: #fff;
    }

    .button-reject:hover:not([disabled]),
    .button-reject:focus:not([disabled]) {
      background: #8e1610 !important;
    }

    /* Result */
    .result {
      font-size: 1rem;
      font-weight: 700;
      padding: 20px 0;
      text-align: center;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      animation: resultIn 0.4s cubic-bezier(0.25, 1, 0.5, 1) both;
    }

    @keyframes resultIn { from { opacity: 0; } to { opacity: 1; } }

    .result.approved { color: #2e7d5b; }
    .result.denied { color: #ac1b11; }
  `]

  constructor () {
    super()
    this.data = null
    this.currentUid = null
    this._remaining = 60
    this._resolved = false
    this._interval = null
    this._autoCloseTimer = null
    this._totalDuration = 60
    this._hasVoted = false
  }

  connectedCallback () {
    super.connectedCallback()
  }

  disconnectedCallback () {
    super.disconnectedCallback()
    this._clearInterval()
    clearTimeout(this._autoCloseTimer)
  }

  updated (changed) {
    if (changed.has('data') && this.data) {
      const wasResolved = this._resolved
      this._resolved = this.data.status === 'approved' || this.data.status === 'denied'

      if (this.data.status === 'pending' && !this._interval) {
        this._totalDuration = Math.max(1, Math.ceil((this.data.expiresAt - Date.now()) / 1000))
        this._startCountdown()
      }

      if (this._resolved && !wasResolved) {
        this._clearInterval()
        this._scheduleAutoClose()
      }

      this._hasVoted = !!(this.data.votes && this.data.votes[this.currentUid])
    }
  }

  open () {
    this.updateComplete.then(() => {
      const dialog = this.renderRoot.querySelector('dialog')
      if (dialog && !dialog.open) dialog.showModal()
    })
  }

  close () {
    this._clearInterval()
    const dialog = this.renderRoot.querySelector('dialog')
    if (dialog?.open) dialog.close()
    this.dispatchEvent(new CustomEvent('promotion-closed', { bubbles: true, composed: true }))
  }

  _startCountdown () {
    this._clearInterval()
    this._updateRemaining()
    this._interval = setInterval(() => {
      this._updateRemaining()
      if (this._remaining <= 0) {
        this._clearInterval()
        this.dispatchEvent(new CustomEvent('promotion-expired', {
          detail: { roomId: this.data?.roomId },
          bubbles: true, composed: true
        }))
      }
    }, 1000)
  }

  _updateRemaining () {
    if (!this.data) return
    this._remaining = Math.max(0, Math.ceil((this.data.expiresAt - Date.now()) / 1000))
  }

  _clearInterval () {
    if (this._interval) {
      clearInterval(this._interval)
      this._interval = null
    }
  }

  _scheduleAutoClose () {
    clearTimeout(this._autoCloseTimer)
    this._autoCloseTimer = setTimeout(() => this.close(), 5000)
  }

  _vote (approve) {
    this._hasVoted = true
    this.dispatchEvent(new CustomEvent('promotion-vote', {
      detail: { vote: approve },
      bubbles: true, composed: true
    }))
  }

  _getVoteStats () {
    const votes = this.data?.votes || {}
    let approveCount = 0
    let rejectCount = 0
    for (const voteData of Object.values(votes)) {
      if (voteData.vote === true) approveCount++
      else rejectCount++
    }
    const votedCount = Object.keys(votes).length
    const pendingCount = Math.max(0, (this.data?.memberCount || 0) - votedCount)
    return { approveCount, rejectCount, pendingCount }
  }

  _getTimerClass () {
    if (this._remaining <= 10) return 'urgent'
    if (this._remaining <= 20) return 'warning'
    return ''
  }

  _getProgressOffset () {
    const fraction = this._remaining / this._totalDuration
    return TIMER_CIRCUMFERENCE * (1 - fraction)
  }

  render () {
    if (!this.data) return html``

    const { approveCount, rejectCount, pendingCount } = this._getVoteStats()
    const votes = this.data.votes || {}
    const timerClass = this._getTimerClass()
    const isResolved = this._resolved
    const isApproved = this.data.status === 'approved'
    const buttonsDisabled = this._hasVoted || isResolved

    return html`
      <dialog @close=${this.close}>
        <header class="dialog__header">
          <h1 class="dialog__title">Host Promotion Vote</h1>
          <button type="button" class="dialog__close" @click=${this.close} aria-label="Close">&#x2715;</button>
        </header>
        <div class="dialog__content">
          <p class="requester-line">
            <strong data-cy="promotion-requester">${this.data.requesterName}</strong> has requested to become host
          </p>

          ${!isResolved ? html`
            <div class="timer-ring">
              <svg class="timer-svg" viewBox="0 0 120 120">
                <circle class="timer-track" cx="60" cy="60" r="52"></circle>
                <circle
                  class="timer-progress ${timerClass}"
                  cx="60" cy="60" r="52"
                  style="stroke-dashoffset: ${this._getProgressOffset()}"
                ></circle>
              </svg>
              <div class="timer-text">
                <span class="timer-value ${timerClass}" data-cy="promotion-countdown">${this._remaining}</span>
                <span class="timer-label">seconds</span>
              </div>
            </div>
          ` : ''}

          <div class="stats">
            <div class="stat stat--approve">
              <span class="stat__count" data-cy="promotion-approve-count">${approveCount}</span>
              <span class="stat__label">Approved</span>
            </div>
            <div class="stat stat--reject">
              <span class="stat__count" data-cy="promotion-reject-count">${rejectCount}</span>
              <span class="stat__label">Rejected</span>
            </div>
            <div class="stat stat--pending">
              <span class="stat__count" data-cy="promotion-pending-count">${pendingCount}</span>
              <span class="stat__label">Pending</span>
            </div>
          </div>

          <div class="votes" data-cy="promotion-votes">
            ${Object.entries(votes).map(([, voteData]) => html`
              <div class="vote-entry">
                <span class="vote-name">${voteData.name}</span>
                <span class="vote-status ${voteData.vote ? 'approve' : 'reject'}">
                  ${voteData.vote ? 'Approved' : 'Rejected'}
                </span>
              </div>
            `)}
            ${pendingCount > 0 ? html`
              <div class="vote-entry">
                <span class="vote-name">${pendingCount} member${pendingCount > 1 ? 's' : ''} pending</span>
                <span class="vote-status pending">Waiting...</span>
              </div>
            ` : ''}
          </div>

          ${isResolved ? html`
            <div class="result ${isApproved ? 'approved' : 'denied'}" data-cy="promotion-result">
              ${isApproved
                ? `${this.data.requesterName} has been promoted to host.`
                : `Host promotion for ${this.data.requesterName} was denied.`}
            </div>
          ` : html`
            <div class="actions" data-cy="promotion-actions">
              <button
                type="button"
                class="button-approve"
                data-cy="promotion-approve"
                ?disabled=${buttonsDisabled}
                @click=${() => this._vote(true)}
              >Approve</button>
              <button
                type="button"
                class="button-reject"
                data-cy="promotion-reject"
                ?disabled=${buttonsDisabled}
                @click=${() => this._vote(false)}
              >Reject</button>
            </div>
          `}
        </div>
      </dialog>
    `
  }
}

customElements.define('promotion-dialog', PromotionDialog)
