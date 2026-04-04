import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// These must be hoisted so they're in place before any import
const mockGetAuth = vi.fn(() => ({ currentUser: { uid: 'test-uid', displayName: 'TestUser' } }))
const mockDatabase = {
  _username: 'MockUser',
  joinGame: vi.fn().mockResolvedValue({}),
  createGame: vi.fn().mockResolvedValue('new-room-id'),
  submitGuess: vi.fn().mockResolvedValue({ score: 3000, distanceKm: 120 }),
  submitMiss: vi.fn().mockResolvedValue({ score: 0 }),
  startGame: vi.fn().mockResolvedValue({}),
  nextRound: vi.fn().mockResolvedValue({}),
  transferHost: vi.fn().mockResolvedValue({}),
  signOut: vi.fn().mockResolvedValue(),
  listenGameChanges: vi.fn(),
  listenPlayers: vi.fn(),
  listenPromotionRequests: vi.fn(),
  requestHostPromotion: vi.fn().mockResolvedValue({ success: true }),
  voteOnHostPromotion: vi.fn().mockResolvedValue({ success: true }),
  resolveHostPromotion: vi.fn().mockResolvedValue({ success: true }),
  cleanup: vi.fn()
}
const mockAlertService = { announce: vi.fn() }

vi.mock('firebase/auth', () => ({
  getAuth: mockGetAuth
}))

vi.mock('../database', () => ({
  default: mockDatabase
}))

vi.mock('../../component/alert/alert', () => ({
  default: mockAlertService
}))

// Ensure Lit component imports don't fail
vi.mock('../../component/timer', () => ({ default: {} }))
vi.mock('../../component/street-view', () => ({ default: {} }))
vi.mock('../../component/result-map', () => ({ default: {} }))
vi.mock('../../component/guess-map', () => ({ default: {} }))
vi.mock('../../component/leaderboard', () => ({ default: {} }))
vi.mock('../../component/game-over', () => ({ default: {} }))
vi.mock('../../component/promotion-dialog', () => ({ default: {} }))

describe('GameView', () => {
  let GameView, el

  beforeEach(async () => {
    vi.clearAllMocks()

    // Create app-view with toolbar
    const appView = document.createElement('div')
    appView.id = 'app-view'
    const body = document.createElement('div')
    body.className = 'site__body'
    const notification = document.createElement('div')
    notification.className = 'site__notification'
    body.appendChild(notification)
    appView.appendChild(body)
    document.body.appendChild(appView)

    const toolbar = document.createElement('div')
    toolbar.id = 'js-toolbar'
    document.body.appendChild(toolbar)

    const mod = await import('./index.js')
    GameView = mod.GameView

    // Ensure the custom element is registered
    if (!customElements.get('game-view')) {
      customElements.define('game-view', GameView)
    }

    el = new GameView()
    document.body.appendChild(el)
  })

  afterEach(() => {
    el?.remove()
    document.getElementById('app-view')?.remove()
    document.getElementById('js-toolbar')?.remove()
  })

  it('is a LitElement subclass', () => {
    expect(el).toBeInstanceOf(GameView)
  })

  it('has correct default property values', () => {
    expect(el.roomId).toBeNull()
    expect(el._gameState).toBeNull()
    expect(el._players).toEqual({})
    expect(el._isHost).toBe(false)
    expect(el._currentRound).toBe(-1)
    expect(el._hasGuessed).toBe(false)
    expect(el._roundInProgress).toBe(false)
    expect(el._scoreResult).toBeNull()
  })

  it('renders game layout with main and sidebar sections', async () => {
    await el.updateComplete
    const layout = el.renderRoot.querySelector('.game-layout')
    expect(layout).toBeTruthy()
    expect(layout.querySelector('.game-main')).toBeTruthy()
    expect(layout.querySelector('.game-sidebar')).toBeTruthy()
    expect(layout.querySelector('.game-sidebar__leaderboard')).toBeTruthy()
    expect(layout.querySelector('.game-sidebar__map')).toBeTruthy()
  })

  it('renders round-timer component', async () => {
    await el.updateComplete
    const timer = el.renderRoot.querySelector('round-timer')
    expect(timer).toBeTruthy()
  })

  it('renders street-view-panel component', async () => {
    await el.updateComplete
    const streetView = el.renderRoot.querySelector('street-view-panel')
    expect(streetView).toBeTruthy()
  })

  it('renders guess-map component', async () => {
    await el.updateComplete
    const map = el.renderRoot.querySelector('guess-map')
    expect(map).toBeTruthy()
  })

  it('renders game-leaderboard component', async () => {
    await el.updateComplete
    const leaderboard = el.renderRoot.querySelector('game-leaderboard')
    expect(leaderboard).toBeTruthy()
  })

  describe('_getStreetViewStatus', () => {
    it('returns loading when no game state', () => {
      el._gameState = null
      expect(el._getStreetViewStatus()).toBe('loading')
    })

    it('returns lobby when status is waiting', () => {
      el._gameState = { status: 'waiting' }
      expect(el._getStreetViewStatus()).toBe('lobby')
    })

    it('returns gameover when status is finished', () => {
      el._gameState = { status: 'finished' }
      expect(el._getStreetViewStatus()).toBe('gameover')
    })

    it('returns playing for playing status', () => {
      el._gameState = { status: 'playing' }
      expect(el._getStreetViewStatus()).toBe('playing')
    })
  })

  describe('_getRound', () => {
    it('returns null when no rounds', () => {
      el._gameState = null
      expect(el._getRound()).toBeNull()
    })

    it('returns current round data', () => {
      el._gameState = { rounds: [{ lat: 10, lng: 20 }], currentRound: 0 }
      expect(el._getRound()).toEqual({ lat: 10, lng: 20 })
    })
  })

  describe('_getPlayerNames', () => {
    it('returns empty string when no players', () => {
      el._gameState = null
      expect(el._getPlayerNames()).toBe('')
    })

    it('returns comma-separated player names', () => {
      el._gameState = {
        players: {
          uid1: { name: 'Alice' },
          uid2: { name: 'Bob' }
        }
      }
      const names = el._getPlayerNames()
      expect(names).toContain('Alice')
      expect(names).toContain('Bob')
    })

    it('uses Anonymous for missing names', () => {
      el._gameState = { players: { uid1: {} } }
      expect(el._getPlayerNames()).toBe('Anonymous')
    })
  })

  describe('_getPlayerCount', () => {
    it('returns 0 when no players', () => {
      el._gameState = null
      expect(el._getPlayerCount()).toBe(0)
    })

    it('returns correct count', () => {
      el._gameState = { players: { a: {}, b: {}, c: {} } }
      expect(el._getPlayerCount()).toBe(3)
    })
  })

  describe('_getGameOverEntries', () => {
    it('returns sorted entries', () => {
      el._gameState = {
        hostId: 'uid1',
        players: {
          uid1: { name: 'Alice', score: 500 },
          uid2: { name: 'Bob', score: 1000 }
        }
      }
      const entries = el._getGameOverEntries()
      expect(entries[0].uid).toBe('uid2')
      expect(entries[0].score).toBe(1000)
      expect(entries[1].isHost).toBe(true)
    })

    it('handles missing players', () => {
      el._gameState = {}
      const entries = el._getGameOverEntries()
      expect(entries).toEqual([])
    })
  })

  describe('_getCurrentUid', () => {
    it('returns current user uid', () => {
      expect(el._getCurrentUid()).toBe('test-uid')
    })
  })

  describe('_onGameStateChange', () => {
    it('sets game state', () => {
      el._onGameStateChange({ status: 'waiting', hostId: 'other' })
      expect(el._gameState.status).toBe('waiting')
    })

    it('resets on new round', async () => {
      await el.updateComplete
      // Add reset method to the picker element in shadow DOM
      const guessMap = el.renderRoot.querySelector('guess-map')
      if (guessMap) guessMap.reset = vi.fn()

      el._currentRound = -1
      el._onGameStateChange({
        status: 'playing',
        currentRound: 0,
        hostId: 'other',
        rounds: [{ lat: 10, lng: 20 }]
      })
      expect(el._currentRound).toBe(0)
      expect(el._hasGuessed).toBe(false)
      expect(el._roundInProgress).toBe(true)
      expect(el._scoreResult).toBeNull()
    })

    it('announces round start', async () => {
      await el.updateComplete
      const guessMap = el.renderRoot.querySelector('guess-map')
      if (guessMap) guessMap.reset = vi.fn()

      el._onGameStateChange({
        status: 'playing',
        currentRound: 0,
        hostId: 'other',
        rounds: [{ lat: 10, lng: 20 }]
      })
      expect(mockAlertService.announce).toHaveBeenCalledWith('Round 1 - Guess the country!')
    })

    it('handles finished status', async () => {
      await el.updateComplete
      // Add stop method to timer
      const timer = el.renderRoot.querySelector('round-timer')
      if (timer) timer.stop = vi.fn()

      el._onGameStateChange({ status: 'finished', hostId: 'other' })
      expect(mockAlertService.announce).toHaveBeenCalledWith('Game finished! Check the final scores.')
    })
  })

  describe('_syncHostState', () => {
    it('sets isHost when current user becomes host', () => {
      el._isHost = false
      el._syncHostState({ hostId: 'test-uid' })
      expect(el._isHost).toBe(true)
      expect(mockAlertService.announce).toHaveBeenCalledWith('You are now the host!')
    })

    it('unsets isHost when host changes away', () => {
      el._isHost = true
      el._syncHostState({ hostId: 'other-uid' })
      expect(el._isHost).toBe(false)
      expect(mockAlertService.announce).toHaveBeenCalledWith('Host role has been transferred.')
    })

    it('does nothing when hostId is missing', () => {
      el._syncHostState({})
    })
  })

  describe('_checkAlreadyGuessed', () => {
    it('marks hasGuessed when player has existing guess', () => {
      el._hasGuessed = false
      el._checkAlreadyGuessed({
        currentRound: 0,
        players: { 'test-uid': { guesses: { 0: { countryCode: 'US' } } } }
      })
      expect(el._hasGuessed).toBe(true)
    })

    it('does not change hasGuessed when no guess exists', () => {
      el._hasGuessed = false
      el._checkAlreadyGuessed({
        currentRound: 0,
        players: { 'test-uid': {} }
      })
      expect(el._hasGuessed).toBe(false)
    })
  })

  describe('_onGuess', () => {
    it('submits guess and sets score result', async () => {
      el.roomId = 'room1'
      el._currentRound = 0
      el._hasGuessed = false
      el._gameState = { rounds: [{ lat: 51.5, lng: -0.1 }], currentRound: 0 }
      await el.updateComplete

      await el._onGuess({ detail: { lat: 50, lng: 0 } })

      expect(mockDatabase.submitGuess).toHaveBeenCalledWith('room1', 0, 50, 0)
      expect(el._hasGuessed).toBe(true)
      expect(el._scoreResult.score).toBe(3000)
      expect(el._scoreResult.distanceKm).toBe(120)
      expect(el._scoreResult.guessLat).toBe(50)
      expect(el._scoreResult.guessLng).toBe(0)
    })

    it('does not submit when already guessed', async () => {
      el._hasGuessed = true
      await el._onGuess({ detail: { lat: 50, lng: 0 } })
      expect(mockDatabase.submitGuess).not.toHaveBeenCalled()
    })

    it('does not submit when coordinates are missing', async () => {
      el._hasGuessed = false
      await el._onGuess({ detail: {} })
      expect(mockDatabase.submitGuess).not.toHaveBeenCalled()
    })

    it('handles guess submission error', async () => {
      mockDatabase.submitGuess.mockRejectedValueOnce(new Error('Network error'))
      el.roomId = 'room1'
      el._currentRound = 0
      el._hasGuessed = false

      await el._onGuess({ detail: { lat: 50, lng: 0 } })

      expect(mockAlertService.announce).toHaveBeenCalledWith('Error submitting guess: Network error')
      expect(el._hasGuessed).toBe(false)
    })
  })

  describe('_onTimerExpired', () => {
    it('does nothing when already guessed', () => {
      el._hasGuessed = true
      const autoSpy = vi.spyOn(el, '_autoSubmit')
      el._onTimerExpired()
      expect(autoSpy).not.toHaveBeenCalled()
    })
  })

  describe('_autoSubmit', () => {
    it('submits miss when no guess placed on map', async () => {
      el.roomId = 'room1'
      el._currentRound = 0
      el._gameState = { rounds: [{ lat: 51.5, lng: -0.1 }], currentRound: 0 }
      await el.updateComplete

      await el._autoSubmit()

      expect(mockDatabase.submitMiss).toHaveBeenCalledWith('room1', 0)
      expect(el._hasGuessed).toBe(true)
      expect(el._scoreResult.score).toBe(0)
      expect(el._scoreResult.guessLat).toBeNull()
      expect(el._scoreResult.guessLng).toBeNull()
    })
  })

  describe('Host controls', () => {
    it('_startGame calls database.startGame', async () => {
      el.roomId = 'room1'
      await el._startGame()
      expect(mockDatabase.startGame).toHaveBeenCalledWith('room1')
    })

    it('_startGame handles error', async () => {
      mockDatabase.startGame.mockRejectedValueOnce(new Error('fail'))
      el.roomId = 'room1'
      await el._startGame()
      expect(mockAlertService.announce).toHaveBeenCalledWith('Failed to start: fail')
    })

    it('_nextRound calls database.nextRound', async () => {
      el.roomId = 'room1'
      await el._nextRound()
      expect(mockDatabase.nextRound).toHaveBeenCalledWith('room1')
    })

    it('_nextRound handles error', async () => {
      mockDatabase.nextRound.mockRejectedValueOnce(new Error('fail'))
      el.roomId = 'room1'
      await el._nextRound()
      expect(mockAlertService.announce).toHaveBeenCalledWith('Failed: fail')
    })

    it('_nextRound resets button text after toolbar sync', async () => {
      // Set up host with playing state so the Next Round button appears
      el._isHost = true
      el._hasGuessed = true
      el._gameState = { status: 'playing', currentRound: 0 }
      el.roomId = 'room1'
      await el.updateComplete

      const toolbar = document.getElementById('js-toolbar')
      const nextBtn = toolbar.querySelector('[data-cy="next-round"]')
      expect(nextBtn).toBeTruthy()
      expect(nextBtn.textContent).toBe('Next Round')

      // Click next round — button should show Loading...
      const nextRoundPromise = el._nextRound()
      expect(nextBtn.textContent).toBe('Loading...')
      expect(nextBtn.disabled).toBe(true)

      await nextRoundPromise

      // Simulate the toolbar sync that happens when game state updates
      el._syncToolbarHostControls()

      expect(nextBtn.textContent).toBe('Next Round')
    })

    it('_signOut calls database.signOut', async () => {
      window.confirm = vi.fn(() => true)
      await el._signOut()
      expect(mockDatabase.signOut).toHaveBeenCalled()
    })

  })

  describe('_shareLink', () => {
    it('copies URL to clipboard', async () => {
      const writeText = vi.fn().mockResolvedValue()
      Object.assign(navigator, { clipboard: { writeText } })

      await el._shareLink()
      expect(writeText).toHaveBeenCalledWith(window.location.href)
      expect(mockAlertService.announce).toHaveBeenCalledWith('Link copied!')
    })

    it('handles clipboard error', async () => {
      Object.assign(navigator, { clipboard: { writeText: vi.fn().mockRejectedValue(new Error()) } })
      await el._shareLink()
      expect(mockAlertService.announce).toHaveBeenCalledWith('Could not copy link')
    })
  })

  describe('_onScoreClosed', () => {
    it('calls clearEffects on street view panel', async () => {
      await el.updateComplete
      const streetView = el.renderRoot.querySelector('street-view-panel')
      if (streetView) {
        streetView.clearEffects = vi.fn()
      }
      el._onScoreClosed()
      if (streetView) {
        expect(streetView.clearEffects).toHaveBeenCalled()
      }
    })
  })

  describe('resumeJourney', () => {
    it('returns early when no user', async () => {
      await el.resumeJourney(null)
      expect(mockDatabase.joinGame).not.toHaveBeenCalled()
      expect(mockDatabase.createGame).not.toHaveBeenCalled()
    })

    it('joins existing game when roomId is in URL', async () => {
      const url = new URL(window.location.href)
      url.searchParams.set('roomId', 'existing-room')
      window.history.replaceState(null, '', url.toString())

      await el.resumeJourney({ displayName: 'Alice', uid: 'test-uid' })

      expect(mockDatabase.joinGame).toHaveBeenCalledWith('existing-room', 'Alice')
      expect(el.roomId).toBe('existing-room')
      expect(el._isHost).toBe(false)

      url.searchParams.delete('roomId')
      window.history.replaceState(null, '', url.toString())
    })

    it('creates new game when no roomId', async () => {
      const url = new URL(window.location.href)
      url.searchParams.delete('roomId')
      window.history.replaceState(null, '', url.toString())

      await el.resumeJourney({ displayName: 'Alice', uid: 'test-uid' })

      expect(mockDatabase.createGame).toHaveBeenCalledWith('Alice')
      expect(el.roomId).toBe('new-room-id')
      expect(el._isHost).toBe(true)
    })

    it('handles join game error', async () => {
      mockDatabase.joinGame.mockRejectedValueOnce(new Error('Room not found'))
      const url = new URL(window.location.href)
      url.searchParams.set('roomId', 'bad-room')
      window.history.replaceState(null, '', url.toString())

      await el.resumeJourney({ displayName: 'Alice', uid: 'test-uid' })
      expect(mockAlertService.announce).toHaveBeenCalledWith('Failed to join game: Room not found')

      url.searchParams.delete('roomId')
      window.history.replaceState(null, '', url.toString())
    })

    it('handles create game error', async () => {
      mockDatabase.createGame.mockRejectedValueOnce(new Error('Server error'))
      const url = new URL(window.location.href)
      url.searchParams.delete('roomId')
      window.history.replaceState(null, '', url.toString())

      await el.resumeJourney({ displayName: 'Alice', uid: 'test-uid' })
      expect(mockAlertService.announce).toHaveBeenCalledWith('Failed to create game: Server error')
    })

    it('uses database._username as fallback when displayName is missing', async () => {
      const url = new URL(window.location.href)
      url.searchParams.delete('roomId')
      window.history.replaceState(null, '', url.toString())

      await el.resumeJourney({ uid: 'test-uid' })
      expect(mockDatabase.createGame).toHaveBeenCalledWith('MockUser')
    })
  })

  describe('render behavior', () => {
    it('hides guess map when game is finished', async () => {
      el._gameState = { status: 'finished', totalRounds: 5, players: {} }
      await el.updateComplete
      const map = el.renderRoot.querySelector('guess-map')
      expect(map.hidden).toBe(true)
    })

    it('disables guess map when not playing or already guessed', async () => {
      el._gameState = { status: 'waiting' }
      el._hasGuessed = false
      await el.updateComplete
      const map = el.renderRoot.querySelector('guess-map')
      // The disabled attribute is set via Lit's ?disabled binding
      expect(map.hasAttribute('disabled') || map.disabled === true).toBe(true)
    })

    it('shows result map when scoreResult is set', async () => {
      el._scoreResult = { score: 3000, distanceKm: 120, guessLat: 10, guessLng: 20, answerLat: 11, answerLng: 21 }
      el._gameState = { status: 'playing', currentRound: 0 }
      await el.updateComplete
      const resultMap = el.renderRoot.querySelector('result-map')
      expect(resultMap).toBeTruthy()
    })

    it('shows game-over when finished', async () => {
      el._gameState = { status: 'finished', totalRounds: 5, players: {}, hostId: 'test' }
      await el.updateComplete
      const gameOver = el.renderRoot.querySelector('game-over')
      expect(gameOver).toBeTruthy()
    })

    it('passes correct round label', async () => {
      el._gameState = { status: 'playing', currentRound: 2, totalRounds: 10 }
      await el.updateComplete
      const timer = el.renderRoot.querySelector('round-timer')
      expect(timer.textContent).toContain('Round 3 / 10')
    })
  })
})
