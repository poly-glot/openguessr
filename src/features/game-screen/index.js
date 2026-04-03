import { getAuth } from 'firebase/auth'
import database from '../database'
import AlertService from '../../component/alert/alert'
import { TimerController } from '../../component/timer'
import { ScoreDisplay } from '../../component/score-display'
import { CountryPicker } from '../../component/country-picker'
import { Leaderboard } from '../../component/leaderboard'
import { StreetView } from '../../component/street-view'

const ROUND_TIME = 30

export class GameScreen {
  constructor () {
    this.roomId = null
    this.isHost = false
    this.currentRound = -1
    this.hasGuessed = false
    this.gameState = null
    this._roundInProgress = false

    this.timer = new TimerController()
    this.scoreDisplay = new ScoreDisplay()
    this.countryPicker = new CountryPicker()
    this.leaderboard = new Leaderboard()
    this.streetView = new StreetView()

    this.timer.onExpired = () => this._autoSubmit()
    this.countryPicker.onSubmit = (code) => this._submitGuess(code)
  }

  // ── Entry point ─────────────────────────────────────────────

  async resumeJourney (user) {
    if (!user) return

    const username = user.displayName || database._username
    const params = new URLSearchParams(window.location.search)
    const roomId = params.get('roomId')

    if (roomId) {
      this.roomId = roomId
      this.isHost = false

      try {
        await database.joinGame(roomId, username)
        AlertService.announce('Joined game!')
        this._setupListeners()
      } catch (err) {
        AlertService.announce('Failed to join game: ' + err.message)
      }
    } else {
      try {
        const newRoomId = await database.createGame(username)
        this.roomId = newRoomId
        this.isHost = true

        const url = new URL(window.location.href)
        url.searchParams.set('roomId', newRoomId)
        window.history.pushState(null, '', url.toString())

        AlertService.announce('Game created! Share the link with friends.')
        this._setupListeners()
        this._showHostControls()
      } catch (err) {
        AlertService.announce('Failed to create game: ' + err.message)
      }
    }
  }

  // ── Listeners ───────────────────────────────────────────────

  _setupListeners () {
    database.listenGameChanges(this.roomId, (state) => {
      this._onGameStateChange(state)
    })

    database.listenPlayers(this.roomId, (players) => {
      this.leaderboard.update(players, this.gameState?.hostId)
    })

    this._bindButton('js-signout', () => database.signOut())
    this._bindButton('js-share-link', async () => {
      try {
        await navigator.clipboard.writeText(window.location.href)
        AlertService.announce('Link copied!')
      } catch {
        AlertService.announce('Could not copy link')
      }
    })
  }

  // ── State machine ───────────────────────────────────────────

  _onGameStateChange (state) {
    this.gameState = state
    this._syncHostState(state)
    this._syncComponents(state)

    this._updateRoundLabel(state)

    if (state.status === 'waiting') {
      this._showWaiting(state)
    } else if (state.status === 'playing') {
      if (state.currentRound !== this.currentRound) {
        this.currentRound = state.currentRound
        this.hasGuessed = false
        this.countryPicker.reset()
        this._roundInProgress = false
        this.scoreDisplay.hide()
        this._startRound(state)
      }
    } else if (state.status === 'finished') {
      this.timer.stop()
      this._showFinished(state)
    }

    this._checkAlreadyGuessed(state)
  }

  _syncHostState (state) {
    const uid = this._getCurrentUid()
    if (!state.hostId || !uid) return

    const wasHost = this.isHost
    if (state.hostId === uid && !wasHost) {
      this.isHost = true
      this._showHostControls()
      AlertService.announce('You are now the host!')
    } else if (state.hostId !== uid && wasHost) {
      this.isHost = false
      this._removeHostControls()
      AlertService.announce('Host role has been transferred.')
    }
  }

  _syncComponents (state) {
    const uid = this._getCurrentUid()
    this.leaderboard.isHost = this.isHost
    this.leaderboard.roomId = this.roomId
    this.leaderboard._currentUid = uid
  }

  _checkAlreadyGuessed (state) {
    const uid = this._getCurrentUid()
    if (uid && state.players?.[uid]?.guesses?.[state.currentRound]) {
      if (!this.hasGuessed) {
        this.hasGuessed = true
        if (!this.isHost && state.status === 'playing') {
          this.scoreDisplay.showWaitingForHost()
        }
      }
    }
  }

  // ── Round lifecycle ─────────────────────────────────────────

  _showWaiting (state) {
    const playerCount = state.players ? Object.keys(state.players).length : 0
    const playerNames = state.players
      ? Object.values(state.players).map(p => this._escapeHtml(p.name || 'Anonymous')).join(', ')
      : ''

    this.streetView.showLobby(playerCount, playerNames)
    this.countryPicker.show(true)
    this.scoreDisplay.hide()
  }

  _startRound (state) {
    const round = state.rounds?.[state.currentRound]
    if (!round || this._roundInProgress) return
    this._roundInProgress = true

    this.streetView.load(round.lat, round.lng)
    this.countryPicker.show()
    this.timer.start(state.roundStartedAt, state.roundTime || ROUND_TIME)

    if (this.isHost) {
      const nextBtn = document.getElementById('js-next-round')
      if (nextBtn) nextBtn.disabled = true
      const startBtn = document.getElementById('js-start-game')
      if (startBtn) startBtn.hidden = true
    }

    AlertService.announce(`Round ${state.currentRound + 1} - Guess the country!`)
  }

  async _submitGuess (countryCode) {
    if (!countryCode || this.hasGuessed) return

    this.hasGuessed = true
    this.countryPicker.disable()

    try {
      const result = await database.submitGuess(this.roomId, this.currentRound, countryCode)

      this.countryPicker.savePinned(countryCode)
      this.scoreDisplay.show(result.correct, result.score, this.gameState?.rounds?.[this.currentRound]?.country)
      this.timer.stop()

      if (this.isHost) {
        const nextBtn = document.getElementById('js-next-round')
        if (nextBtn) nextBtn.disabled = false
      } else {
        this.scoreDisplay.showWaitingForHost()
      }
    } catch (err) {
      AlertService.announce('Error submitting guess: ' + err.message)
      this.hasGuessed = false
      const submitBtn = document.getElementById('js-submit-guess')
      if (submitBtn) submitBtn.disabled = false
    }
  }

  async _autoSubmit () {
    if (this.hasGuessed) return

    if (this.countryPicker.selectedCountry) {
      await this._submitGuess(this.countryPicker.selectedCountry)
    } else {
      this.hasGuessed = true
      this.countryPicker.disable()

      try {
        await database.submitMiss(this.roomId, this.currentRound)
      } catch {
        // Best-effort
      }

      this.scoreDisplay.show(false, 0, this.gameState?.rounds?.[this.currentRound]?.country)

      if (this.isHost) {
        const nextBtn = document.getElementById('js-next-round')
        if (nextBtn) nextBtn.disabled = false
      } else {
        this.scoreDisplay.showWaitingForHost()
      }
    }
  }

  _showFinished (state) {
    const players = state.players || {}
    const entries = Object.entries(players)
      .map(([uid, data]) => ({
        uid,
        name: data.name || uid,
        score: data.score || 0,
        isHost: uid === state.hostId
      }))
      .sort((a, b) => b.score - a.score)

    const winner = entries[0]
    const currentUid = this._getCurrentUid()
    const isWinner = winner && winner.uid === currentUid
    const totalRounds = state.totalRounds || 5

    this.streetView.showGameOver(`
      <div class="street-view__placeholder game-over" data-cy="game-over">
        <h2 class="game-over__title">Game Over!</h2>
        ${winner ? `<div class="game-over__winner" data-cy="winner">
          ${isWinner ? 'You win!' : `${this._escapeHtml(winner.name)} wins!`}
        </div>` : ''}
        <div class="game-over__final-scores" data-cy="final-scores">
          <table class="game-over__table">
            <thead>
              <tr><th>Rank</th><th>Player</th><th>Score</th></tr>
            </thead>
            <tbody>
              ${entries.map((e, i) => `
                <tr class="${e.uid === currentUid ? 'game-over__row--self' : ''}">
                  <td>${i + 1}</td>
                  <td>${this._escapeHtml(e.name)}${e.isHost ? ' <small>(host)</small>' : ''}</td>
                  <td>${e.score} / ${totalRounds * 1500}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        <div class="game-over__actions">
          <button type="button" class="cta-button" data-cy="play-again" onclick="window.location.href='/'">Play Again</button>
        </div>
      </div>
    `)

    this.countryPicker.hide()
    this.scoreDisplay.hide()
    this.timer.setDone()

    AlertService.announce('Game finished! Check the final scores.')
  }

  // ── Host controls ───────────────────────────────────────────

  _showHostControls () {
    const template = document.querySelector('.site__host-controls')
    if (!template) return

    const controls = template.content.cloneNode(true)
    template.parentNode.appendChild(controls)

    this._bindButton('js-start-game', async (btn) => {
      try {
        btn.disabled = true
        await database.startGame(this.roomId)
        btn.hidden = true
      } catch (err) {
        AlertService.announce('Failed to start: ' + err.message)
        btn.disabled = false
      }
    })

    this._bindButton('js-next-round', async (btn) => {
      try {
        btn.disabled = true
        await database.nextRound(this.roomId)
      } catch (err) {
        AlertService.announce('Failed: ' + err.message)
        btn.disabled = false
      }
    })
  }

  _removeHostControls () {
    const startBtn = document.getElementById('js-start-game')
    if (startBtn) startBtn.remove()
    const nextBtn = document.getElementById('js-next-round')
    if (nextBtn) nextBtn.remove()
  }

  // ── Utilities ───────────────────────────────────────────────

  _updateRoundLabel (state) {
    const el = document.getElementById('js-round-label')
    if (el) el.textContent = `Round ${(state.currentRound || 0) + 1} / ${state.totalRounds || 5}`
  }

  _bindButton (id, handler) {
    const btn = document.getElementById(id)
    if (btn && !btn._bound) {
      btn._bound = true
      btn.addEventListener('click', () => handler(btn))
    }
  }

  _getCurrentUid () {
    try {
      return getAuth().currentUser?.uid
    } catch {
      return null
    }
  }

  _escapeHtml (str) {
    const div = document.createElement('div')
    div.textContent = str
    return div.innerHTML
  }
}

export default new GameScreen()
