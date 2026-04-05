import { LitElement, html, css } from 'lit'
import { getAuth } from 'firebase/auth'
import database from '../database'
import AlertService from '../../component/alert/alert'

import '../../component/timer'
import '../../component/street-view'
import '../../component/guess-map'
import '../../component/result-map'
import '../../component/leaderboard'
import '../../component/game-over'
import '../../component/promotion-dialog'

const ROUND_TIME = 30

export class GameView extends LitElement {
  static properties = {
    roomId: { type: String, attribute: 'room-id' },
    _gameState: { state: true },
    _players: { state: true },
    _isHost: { state: true },
    _currentRound: { state: true },
    _hasGuessed: { state: true },
    _roundInProgress: { state: true },
    _scoreResult: { state: true },
    _joinError: { state: true },
    _disconnected: { state: true },
    _promotionData: { state: true }
  }

  static styles = css`
    :host { display: flex; flex-direction: column; flex: 1; min-height: 0; }

    .game-layout {
      display: grid;
      grid-template-columns: 1fr 440px;
      grid-template-rows: 1fr;
      flex: 1;
      min-height: 0;
      overflow: hidden;
    }

    .game-main {
      min-width: 0;
      min-height: 0;
      display: flex;
      flex-direction: column;
    }

    .game-sidebar {
      border-left: 1px solid var(--borderColor, rgb(0 0 0 / 15%));
      background: #fafafa;
      display: flex;
      flex-direction: column;
      min-height: 0;
      overflow: hidden;
    }

    .game-sidebar__leaderboard {
      flex-shrink: 0;
      overflow-y: auto;
      max-height: 40%;
      border-bottom: 1px solid var(--borderColor, rgb(0 0 0 / 15%));
    }

    .game-sidebar__map {
      flex: 1;
      min-height: 0;
    }

    .street-view-wrap {
      position: relative;
      flex: 1;
      min-height: 0;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .join-error {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      flex: 1;
      gap: 12px;
      padding: 40px;
      text-align: center;
    }

    .join-error__title {
      font-size: 1.4rem;
      font-weight: 700;
      color: var(--color-error, #ac1b11);
      margin: 0;
    }

    .join-error__message {
      font-size: 0.9rem;
      color: #666;
      margin: 0;
    }

    .join-error button {
      margin-top: 8px;
      padding: 10px 24px;
      background: #111;
      color: #fff;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.85rem;
      font-weight: 600;
    }

    .join-error button:hover { background: #333; }

    .disconnected-banner {
      background: var(--color-error, #ac1b11);
      color: #fff;
      text-align: center;
      padding: 6px 16px;
      font-size: 0.78rem;
      font-weight: 600;
      letter-spacing: 0.03em;
      flex-shrink: 0;
    }

    @media (max-width: 900px) {
      /* Fit the whole game into one viewport — avoids fighting the maps
         for vertical touch gestures. Each half is interactive and sized;
         no outer page scroll needed. */
      .game-layout {
        display: flex;
        flex-direction: column;
        height: 100%;
        overflow: hidden;
      }
      .game-main {
        flex: 0 0 55%;
        min-height: 0;
      }
      .game-sidebar {
        flex: 0 0 45%;
        min-height: 0;
        width: 100%;
        border-left: none;
        border-top: 1px solid var(--borderColor, rgb(0 0 0 / 15%));
      }
      .game-sidebar__leaderboard { max-height: 35%; }
    }
  `

  constructor () {
    super()
    this.roomId = null
    this._gameState = null
    this._players = {}
    this._isHost = false
    this._currentRound = -1
    this._hasGuessed = false
    this._roundInProgress = false
    this._scoreResult = null
    this._joinError = null
    this._disconnected = false
    this._promotionData = null
    this._journeyInProgress = false
  }

  // ── Entry point ─────────────────────────────────────────────

  async resumeJourney (user) {
    if (!user) return

    // Guard against re-entrant calls caused by createGame triggering
    // a second onAuthStateChanged via signInWithCustomToken
    if (this._journeyInProgress) return
    this._journeyInProgress = true

    try {
      const params = new URLSearchParams(window.location.search)
      const roomId = params.get('roomId')

      // Already connected to this room — skip
      if (roomId && roomId === this.roomId) return

      // Clean up previous game if starting fresh
      if (this.roomId) {
        database.cleanup()
        this.roomId = null
        this._gameState = null
        this._players = {}
        this._isHost = false
        this._currentRound = -1
        this._hasGuessed = false
        this._scoreResult = null
      }

      const username = user.displayName || database._username

      if (roomId) {
        this.roomId = roomId
        this._isHost = false

        try {
          await database.joinGame(roomId, username)
          AlertService.announce('Joined game!')
          this._setupListeners()
          database.setupPresence(this.roomId, user.uid)
        } catch (err) {
          AlertService.announce('Failed to join game: ' + err.message)
          this._showJoinError(err.message)
        }
      } else {
        try {
          const newRoomId = await database.createGame(username)
          this.roomId = newRoomId
          this._isHost = true

          const url = new URL(window.location.href)
          url.searchParams.set('roomId', newRoomId)
          window.history.pushState(null, '', url.toString())

          AlertService.announce('Game created! Share the link with friends.')
          this._setupListeners()
          database.setupPresence(this.roomId, user.uid)
        } catch (err) {
          AlertService.announce('Failed to create game: ' + err.message)
        }
      }
    } finally {
      this._journeyInProgress = false
    }
  }

  // ── Listeners ───────────────────────────────────────────────

  _setupListeners () {
    database.listenGameChanges(this.roomId, (state) => {
      this._onGameStateChange(state)
    })

    database.listenPlayers(this.roomId, (players) => {
      this._players = { ...players }
      this._checkHostPresence()
    })

    database.listenConnection(
      () => { this._disconnected = false },
      () => { this._disconnected = true }
    )

    database.listenPromotionRequests(this.roomId, (data) => {
      this._onPromotionUpdate(data)
    })

    this._renderToolbar()
  }

  // ── Toolbar (light DOM for AlertService compatibility) ──────

  _renderToolbar () {
    const toolbar = document.getElementById('js-toolbar')
    if (!toolbar || toolbar._bound) return
    toolbar._bound = true

    // Secondary actions live inside a burger menu wrapper.
    // On desktop CSS flattens them inline; on mobile they collapse to a dropdown.
    const menu = document.createElement('div')
    menu.className = 'toolbar-menu'
    menu.dataset.cy = 'toolbar-menu'
    menu.dataset.open = 'false'

    const trigger = document.createElement('button')
    trigger.type = 'button'
    trigger.className = 'toolbar-menu__btn'
    trigger.setAttribute('aria-label', 'More actions')
    trigger.setAttribute('aria-expanded', 'false')
    trigger.innerHTML = '<span class="toolbar-menu__icon" aria-hidden="true"></span>'
    trigger.addEventListener('click', (e) => {
      e.stopPropagation()
      const open = menu.dataset.open !== 'true'
      menu.dataset.open = String(open)
      trigger.setAttribute('aria-expanded', String(open))
    })

    const items = document.createElement('div')
    items.className = 'toolbar-menu__items'

    const closeMenu = () => {
      menu.dataset.open = 'false'
      trigger.setAttribute('aria-expanded', 'false')
    }

    const shareBtn = document.createElement('button')
    shareBtn.type = 'button'
    shareBtn.className = 'button-link'
    shareBtn.dataset.cy = 'copy'
    shareBtn.textContent = 'Copy & Share Link'
    shareBtn.addEventListener('click', () => { closeMenu(); this._shareLink() })

    const signoutBtn = document.createElement('button')
    signoutBtn.type = 'button'
    signoutBtn.className = 'button-link'
    signoutBtn.dataset.cy = 'signout'
    signoutBtn.textContent = 'Sign out'
    signoutBtn.addEventListener('click', () => { closeMenu(); this._signOut() })

    items.appendChild(shareBtn)
    items.appendChild(signoutBtn)
    menu.appendChild(trigger)
    menu.appendChild(items)

    // Close burger on outside click
    document.addEventListener('click', (e) => {
      if (menu.dataset.open === 'true' && !menu.contains(e.target)) closeMenu()
    })

    toolbar.appendChild(menu)
  }

  updated () {
    this._syncToolbarHostControls()
  }

  _syncToolbarHostControls () {
    const toolbar = document.getElementById('js-toolbar')
    if (!toolbar) return

    const state = this._gameState
    const showStart = this._isHost && state?.status === 'waiting'
    const showNext = this._isHost && state?.status === 'playing'

    let startBtn = toolbar.querySelector('[data-cy="start-game-btn"]')
    let nextBtn = toolbar.querySelector('[data-cy="next-round"]')

    // Insert primary actions BEFORE the burger menu so the menu stays at the end.
    const menu = toolbar.querySelector('.toolbar-menu')

    if (showStart && !startBtn) {
      startBtn = document.createElement('button')
      startBtn.type = 'button'
      startBtn.className = 'button-secondary'
      startBtn.dataset.cy = 'start-game-btn'
      startBtn.textContent = 'Start Game'
      startBtn.addEventListener('click', () => this._startGame())
      toolbar.insertBefore(startBtn, menu)
    } else if (!showStart && startBtn) {
      startBtn.remove()
    }

    if (showNext && !nextBtn) {
      nextBtn = document.createElement('button')
      nextBtn.type = 'button'
      nextBtn.className = 'button-secondary button-branded'
      nextBtn.dataset.cy = 'next-round'
      nextBtn.textContent = 'Next Round'
      nextBtn.disabled = !this._hasGuessed
      nextBtn.addEventListener('click', () => this._nextRound())
      toolbar.insertBefore(nextBtn, menu)
    } else if (showNext && nextBtn) {
      nextBtn.disabled = !this._hasGuessed
      nextBtn.textContent = 'Next Round'
    } else if (!showNext && nextBtn) {
      nextBtn.remove()
    }
  }

  // ── State machine ───────────────────────────────────────────

  _onGameStateChange (state) {
    this._gameState = { ...state }
    this._syncHostState(state)

    if (state.status === 'playing') {
      if (state.currentRound !== this._currentRound) {
        this._currentRound = state.currentRound
        this._hasGuessed = false
        this._scoreResult = null
        this._roundInProgress = true

        const guessMap = this.renderRoot.querySelector('guess-map')
        if (guessMap) guessMap.reset()

        const round = state.rounds?.[state.currentRound]
        if (round) {
          AlertService.announce(`Round ${state.currentRound + 1} - Guess the country!`)
        }
      }
    } else if (state.status === 'finished') {
      this._stopTimer()
      AlertService.announce('Game finished! Check the final scores.')
    }

    this._checkAlreadyGuessed(state)
  }

  _syncHostState (state) {
    const uid = this._getCurrentUid()
    if (!state.hostId || !uid) return

    const wasHost = this._isHost
    if (state.hostId === uid && !wasHost) {
      this._isHost = true
      AlertService.announce('You are now the host!')
    } else if (state.hostId !== uid && wasHost) {
      this._isHost = false
      AlertService.announce('Host role has been transferred.')
    }
  }

  _checkHostPresence () {
    if (this._isHost || !this._gameState) return
    // Current user is not the host - check if host went offline
    const hostId = this._gameState.hostId
    const hostData = this._players[hostId]
    if (hostData && hostData.online === false) {
      const uid = this._getCurrentUid()
      const entries = Object.entries(this._players)
        .filter(([id, data]) => id !== hostId && data.online !== false)
        .sort(([, a], [, b]) => (b.score || 0) - (a.score || 0))
      if (entries.length > 0 && entries[0][0] === uid) {
        database.transferHost(this.roomId, uid).catch(() => {})
      }
    }
  }

  _checkAlreadyGuessed (state) {
    const uid = this._getCurrentUid()
    if (uid && state.players?.[uid]?.guesses?.[state.currentRound]) {
      if (!this._hasGuessed) {
        this._hasGuessed = true
      }
    }
  }

  // ── Round actions ───────────────────────────────────────────

  async _onGuess (e) {
    const { lat, lng } = e.detail
    if (lat == null || lng == null || this._hasGuessed) return

    this._hasGuessed = true

    try {
      const result = await database.submitGuess(this.roomId, this._currentRound, lat, lng)

      const round = this._getRound()
      this._scoreResult = {
        score: result.score,
        distanceKm: result.distanceKm,
        guessLat: lat,
        guessLng: lng,
        answerLat: round?.lat,
        answerLng: round?.lng
      }
    } catch (err) {
      AlertService.announce('Error submitting guess: ' + err.message)
      this._hasGuessed = false
    }
  }

  _onTimerExpired () {
    if (this._hasGuessed) return
    this._checkAlreadyGuessed(this._gameState)
    if (this._hasGuessed) return
    this._autoSubmit()
  }

  async _autoSubmit () {
    const guessMap = this.renderRoot.querySelector('guess-map')
    const lat = guessMap?.selectedLat
    const lng = guessMap?.selectedLng

    if (lat != null && lng != null) {
      await this._onGuess({ detail: { lat, lng } })
    } else {
      this._hasGuessed = true

      try {
        await database.submitMiss(this.roomId, this._currentRound)
      } catch {
        // Best-effort
      }

      const round = this._getRound()
      this._scoreResult = {
        score: 0,
        distanceKm: null,
        guessLat: null,
        guessLng: null,
        answerLat: round?.lat,
        answerLng: round?.lng
      }
    }
  }

  _stopTimer () {
    const timer = this.renderRoot.querySelector('round-timer')
    if (timer) timer.stop()
  }

  // ── Host controls ───────────────────────────────────────────

  async _startGame () {
    const btn = document.querySelector('[data-cy="start-game-btn"]')
    if (btn) { btn.disabled = true; btn.textContent = 'Starting...' }
    try {
      await database.startGame(this.roomId)
    } catch (err) {
      AlertService.announce('Failed to start: ' + err.message)
      if (btn) { btn.disabled = false; btn.textContent = 'Start Game' }
    }
  }

  async _nextRound () {
    const btn = document.querySelector('[data-cy="next-round"]')
    if (btn) { btn.disabled = true; btn.textContent = 'Loading...' }
    try {
      await database.nextRound(this.roomId)
    } catch (err) {
      AlertService.announce('Failed: ' + err.message)
      if (btn) { btn.disabled = false; btn.textContent = 'Next Round' }
    }
  }

  async _shareLink () {
    try {
      await navigator.clipboard.writeText(window.location.href)
      AlertService.announce('Link copied!')
    } catch {
      AlertService.announce('Could not copy link')
    }
  }

  async _signOut () {
    if (!confirm('Leave the game? You will be disconnected.')) return
    await database.signOut()
  }

  _showJoinError (message) {
    this._joinError = message
    const url = new URL(window.location.href)
    if (url.searchParams.has('roomId')) {
      url.searchParams.delete('roomId')
      window.history.replaceState(null, '', url.toString())
    }
  }

  _goHome () {
    window.location.href = '/'
  }

  // ── Promotion ───────────────────────────────────────────────

  _onPromotionUpdate (data) {
    if (!data) {
      this._promotionData = null
      return
    }

    if (data.status === 'pending' && Date.now() < data.expiresAt) {
      this._promotionData = { ...data }
      this.updateComplete.then(() => {
        const dialog = this.renderRoot.querySelector('promotion-dialog')
        if (dialog) dialog.open()
      })
    } else if (data.status === 'approved' || data.status === 'denied') {
      this._promotionData = { ...data }
      this.updateComplete.then(() => {
        const dialog = this.renderRoot.querySelector('promotion-dialog')
        if (dialog) dialog.open()
      })
    }
  }

  async _requestHost () {
    try {
      const result = await database.requestHostPromotion(this.roomId)
      AlertService.announce('Host promotion request submitted')

      if (result.resolved && result.requestData) {
        this._promotionData = { ...result.requestData }
        this.updateComplete.then(() => {
          const dialog = this.renderRoot.querySelector('promotion-dialog')
          if (dialog) dialog.open()
        })
      }
    } catch (err) {
      AlertService.announce(err.message || 'Failed to request host promotion')
    }
  }

  async _onPromotionVote (e) {
    try {
      await database.voteOnHostPromotion(this.roomId, e.detail.vote)
    } catch (err) {
      AlertService.announce(err.message || 'Failed to submit vote')
    }
  }

  async _onPromotionExpired () {
    try {
      await database.resolveHostPromotion(this.roomId)
    } catch {
      // Resolution may have already happened via early majority
    }
  }

  _onPromotionClosed () {
    this._promotionData = null
  }

  // ── Utilities ───────────────────────────────────────────────

  _getCurrentUid () {
    try {
      return getAuth().currentUser?.uid
    } catch {
      return null
    }
  }

  _getStreetViewStatus () {
    const state = this._gameState
    if (!state) return 'loading'
    if (state.status === 'waiting') return 'lobby'
    if (state.status === 'finished') return 'gameover'
    return 'playing'
  }

  _getRound () {
    if (!this._gameState?.rounds) return null
    return this._gameState.rounds[this._gameState.currentRound]
  }

  _getPlayerNames () {
    const players = this._gameState?.players
    if (!players) return ''
    return Object.values(players).map(p => p.name || 'Anonymous').join(', ')
  }

  _getPlayerCount () {
    const players = this._gameState?.players
    return players ? Object.keys(players).length : 0
  }

  _getGameOverEntries () {
    const players = this._gameState?.players || {}
    return Object.entries(players)
      .map(([uid, data]) => ({
        uid,
        name: data.name || uid,
        score: data.score || 0,
        isHost: uid === this._gameState?.hostId
      }))
      .sort((a, b) => b.score - a.score)
  }

  _onScoreClosed () {
    const streetView = this.renderRoot.querySelector('street-view-panel')
    streetView?.clearEffects()
  }

  // ── Render ──────────────────────────────────────────────────

  render () {
    if (this._joinError) {
      return html`
        <div class="join-error">
          <h2 class="join-error__title">Unable to join game</h2>
          <p class="join-error__message">${this._joinError}</p>
          <button type="button" @click=${this._goHome}>Back to Home</button>
        </div>
      `
    }

    const state = this._gameState
    const status = this._getStreetViewStatus()
    const round = this._getRound()
    const roundLabel = `Round ${(state?.currentRound || 0) + 1} / ${state?.totalRounds || 5}`
    const isPlaying = state?.status === 'playing'
    const isFinished = state?.status === 'finished'
    const showScore = !!this._scoreResult
    const showPicker = !isFinished

    return html`
      ${this._promotionData ? html`
        <promotion-dialog
          .data=${this._promotionData}
          current-uid=${this._getCurrentUid() || ''}
          @promotion-vote=${this._onPromotionVote}
          @promotion-expired=${this._onPromotionExpired}
          @promotion-closed=${this._onPromotionClosed}
        ></promotion-dialog>
      ` : ''}
      ${this._disconnected ? html`
        <div class="disconnected-banner" role="alert">Connection lost — reconnecting...</div>
      ` : ''}
      <div class="game-layout">
        <div class="game-main">
          <round-timer
            .startedAt=${isPlaying && round ? (state.roundStartedAt || 0) : 0}
            .duration=${state?.roundTime || ROUND_TIME}
            @timer-expired=${this._onTimerExpired}
          >${roundLabel}</round-timer>

          <div class="street-view-wrap">
            <street-view-panel
              .lat=${round?.lat ?? null}
              .lng=${round?.lng ?? null}
              .status=${status}
              .playerCount=${this._getPlayerCount()}
              .playerNames=${this._getPlayerNames()}
            >
              ${isFinished ? html`
                <game-over
                  slot="gameover"
                  .players=${this._getGameOverEntries()}
                  current-uid=${this._getCurrentUid() || ''}
                  .totalRounds=${state?.totalRounds || 5}
                ></game-over>
              ` : ''}
            </street-view-panel>
            ${showScore ? html`
              <result-map
                ?visible=${showScore}
                .guessLat=${this._scoreResult.guessLat}
                .guessLng=${this._scoreResult.guessLng}
                .answerLat=${this._scoreResult.answerLat}
                .answerLng=${this._scoreResult.answerLng}
                .distanceKm=${this._scoreResult.distanceKm}
                .score=${this._scoreResult.score}
                ?waiting-for-host=${this._hasGuessed && !this._isHost && isPlaying}
                @score-closed=${this._onScoreClosed}
              ></result-map>
            ` : ''}
          </div>
        </div>

        <aside class="game-sidebar">
          <div class="game-sidebar__leaderboard">
            <game-leaderboard
              .players=${this._players}
              host-id=${state?.hostId || ''}
              current-uid=${this._getCurrentUid() || ''}
              ?is-host=${this._isHost}
              room-id=${this.roomId || ''}
              @request-host=${this._requestHost}
            ></game-leaderboard>
          </div>
          <div class="game-sidebar__map">
            <guess-map
              ?hidden=${!showPicker}
              ?disabled=${!isPlaying || this._hasGuessed}
              @guess=${this._onGuess}
            ></guess-map>
          </div>
        </aside>
      </div>
    `
  }
}

customElements.define('game-view', GameView)

// Create singleton instance and append to DOM when needed
let gameViewInstance = null

function getGameView () {
  if (!gameViewInstance) {
    gameViewInstance = document.createElement('game-view')
    const appView = document.getElementById('app-view')
    if (appView) {
      const main = appView.querySelector('.site__body')
      if (main) {
        // Insert after the notification bar
        const notification = main.querySelector('.site__notification')
        if (notification) {
          notification.after(gameViewInstance)
        } else {
          main.appendChild(gameViewInstance)
        }
      }
    }
  }
  return gameViewInstance
}

export default {
  async resumeJourney (user) {
    const view = getGameView()
    await view.resumeJourney(user)
  }
}
