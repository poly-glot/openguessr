import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mockOnValue = vi.fn()
const mockOff = vi.fn()
const mockRef = vi.fn((db, path) => ({ path }))
const mockGetDatabase = vi.fn(() => ({}))
const mockHttpsCallable = vi.fn()
const mockGetFunctions = vi.fn()
const mockGetApp = vi.fn(() => ({ name: 'mock-app' }))
const mockSignInWithCustomToken = vi.fn()
const mockUpdateProfile = vi.fn()
const mockFirebaseSignOut = vi.fn()
const mockGetAuth = vi.fn(() => ({ currentUser: { uid: 'test-uid' } }))
const mockOnAuthStateChanged = vi.fn()

vi.mock('firebase/database', () => ({
  getDatabase: (...args) => mockGetDatabase(...args),
  ref: (...args) => mockRef(...args),
  onValue: (...args) => mockOnValue(...args),
  off: (...args) => mockOff(...args)
}))

vi.mock('firebase/functions', () => ({
  getFunctions: (...args) => mockGetFunctions(...args),
  httpsCallable: (...args) => mockHttpsCallable(...args)
}))

vi.mock('firebase/app', () => ({
  getApp: (...args) => mockGetApp(...args)
}))

vi.mock('firebase/auth', () => ({
  getAuth: (...args) => mockGetAuth(...args),
  onAuthStateChanged: (...args) => mockOnAuthStateChanged(...args),
  signInWithCustomToken: (...args) => mockSignInWithCustomToken(...args),
  updateProfile: (...args) => mockUpdateProfile(...args),
  signOut: (...args) => mockFirebaseSignOut(...args)
}))

vi.mock('../auth-dialog', () => ({
  default: { toggleVisibilityBasedOnAuth: vi.fn() }
}))

vi.mock('../game-screen', () => ({
  default: { resumeJourney: vi.fn() }
}))

describe('GameDatabase', () => {
  let db

  beforeEach(async () => {
    vi.clearAllMocks()
    const { GameDatabase } = await import('./index.js')
    db = new GameDatabase()
  })

  it('constructor initializes properties', () => {
    expect(db.gameRef).toBeNull()
    expect(db.playersRef).toBeNull()
    expect(db._listeners).toEqual([])
    expect(db._username).toBeNull()
  })

  describe('signIn', () => {
    it('calls login cloud function and signs in with token', async () => {
      const loginFn = vi.fn().mockResolvedValue({ data: { token: 'test-token' } })
      mockHttpsCallable.mockReturnValue(loginFn)
      mockSignInWithCustomToken.mockResolvedValue()
      mockUpdateProfile.mockResolvedValue()
      mockGetAuth.mockReturnValue({ currentUser: { uid: 'test' } })

      await db.signIn('TestUser')

      expect(db._username).toBe('TestUser')
      expect(loginFn).toHaveBeenCalledWith({ username: 'TestUser' })
      expect(mockSignInWithCustomToken).toHaveBeenCalled()
      expect(mockUpdateProfile).toHaveBeenCalled()
    })
  })

  describe('signOut', () => {
    it('calls cleanup and firebase signOut', async () => {
      const cleanupSpy = vi.spyOn(db, 'cleanup')
      mockFirebaseSignOut.mockResolvedValue()
      await db.signOut()
      expect(cleanupSpy).toHaveBeenCalled()
      expect(mockFirebaseSignOut).toHaveBeenCalled()
    })
  })

  describe('createGame', () => {
    it('calls createGame function and returns roomId', async () => {
      const createFn = vi.fn().mockResolvedValue({ data: { roomId: 'room123', token: 'tok' } })
      mockHttpsCallable.mockReturnValue(createFn)
      mockSignInWithCustomToken.mockResolvedValue()
      mockUpdateProfile.mockResolvedValue()
      mockGetAuth.mockReturnValue({ currentUser: { uid: 'test' } })

      const roomId = await db.createGame('Alice')
      expect(roomId).toBe('room123')
      expect(createFn).toHaveBeenCalledWith({ username: 'Alice' })
    })
  })

  describe('joinGame', () => {
    it('calls joinGame function', async () => {
      const joinFn = vi.fn().mockResolvedValue({ data: { success: true } })
      mockHttpsCallable.mockReturnValue(joinFn)

      const result = await db.joinGame('room123', 'Bob')
      expect(result).toEqual({ success: true })
      expect(joinFn).toHaveBeenCalledWith({ roomId: 'room123', username: 'Bob' })
    })
  })

  describe('submitGuess', () => {
    it('calls submitGuess function', async () => {
      const guessFn = vi.fn().mockResolvedValue({ data: { score: 3000, distanceKm: 120 } })
      mockHttpsCallable.mockReturnValue(guessFn)

      const result = await db.submitGuess('room1', 0, 50, -0.1)
      expect(result).toEqual({ score: 3000, distanceKm: 120 })
      expect(guessFn).toHaveBeenCalledWith({ roomId: 'room1', round: 0, lat: 50, lng: -0.1 })
    })
  })

  describe('submitMiss', () => {
    it('calls submitMiss function', async () => {
      const missFn = vi.fn().mockResolvedValue({ data: { score: 0 } })
      mockHttpsCallable.mockReturnValue(missFn)

      const result = await db.submitMiss('room1', 2)
      expect(result).toEqual({ score: 0 })
      expect(missFn).toHaveBeenCalledWith({ roomId: 'room1', round: 2 })
    })
  })

  describe('nextRound', () => {
    it('calls nextRound function', async () => {
      const nextFn = vi.fn().mockResolvedValue({ data: { round: 1 } })
      mockHttpsCallable.mockReturnValue(nextFn)

      const result = await db.nextRound('room1')
      expect(result).toEqual({ round: 1 })
    })
  })

  describe('startGame', () => {
    it('calls startGame function', async () => {
      const startFn = vi.fn().mockResolvedValue({ data: { status: 'playing' } })
      mockHttpsCallable.mockReturnValue(startFn)

      const result = await db.startGame('room1')
      expect(result).toEqual({ status: 'playing' })
    })
  })

  describe('transferHost', () => {
    it('calls transferHost function', async () => {
      const transferFn = vi.fn().mockResolvedValue({ data: { ok: true } })
      mockHttpsCallable.mockReturnValue(transferFn)

      const result = await db.transferHost('room1', 'uid2')
      expect(result).toEqual({ ok: true })
      expect(transferFn).toHaveBeenCalledWith({ roomId: 'room1', targetUid: 'uid2' })
    })
  })

  describe('listenGameChanges', () => {
    it('sets up onValue listener on game ref', () => {
      const cb = vi.fn()
      db.listenGameChanges('room1', cb)

      expect(mockRef).toHaveBeenCalledWith(expect.anything(), 'games/room1')
      expect(mockOnValue).toHaveBeenCalled()
      expect(db.gameRef).toBeTruthy()
      expect(db._listeners.length).toBe(1)
    })

    it('calls callback with snapshot data', () => {
      const cb = vi.fn()
      mockOnValue.mockImplementation((ref, handler) => {
        handler({ val: () => ({ status: 'waiting' }) })
      })

      db.listenGameChanges('room1', cb)
      expect(cb).toHaveBeenCalledWith({ status: 'waiting' })
    })

    it('does not call callback when data is null', () => {
      const cb = vi.fn()
      mockOnValue.mockImplementation((ref, handler) => {
        handler({ val: () => null })
      })

      db.listenGameChanges('room1', cb)
      expect(cb).not.toHaveBeenCalled()
    })
  })

  describe('listenPlayers', () => {
    it('sets up onValue listener on players ref', () => {
      const cb = vi.fn()
      db.listenPlayers('room1', cb)

      expect(mockRef).toHaveBeenCalledWith(expect.anything(), 'games/room1/players')
      expect(mockOnValue).toHaveBeenCalled()
      expect(db.playersRef).toBeTruthy()
      expect(db._listeners.length).toBe(1)
    })

    it('calls callback with snapshot data', () => {
      const cb = vi.fn()
      mockOnValue.mockImplementation((ref, handler) => {
        handler({ val: () => ({ uid1: { name: 'Alice' } }) })
      })

      db.listenPlayers('room1', cb)
      expect(cb).toHaveBeenCalledWith({ uid1: { name: 'Alice' } })
    })

    it('does not call callback when data is null', () => {
      const cb = vi.fn()
      mockOnValue.mockImplementation((ref, handler) => {
        handler({ val: () => null })
      })

      db.listenPlayers('room1', cb)
      expect(cb).not.toHaveBeenCalled()
    })
  })

  describe('cleanup', () => {
    it('calls off on all listeners and resets refs', () => {
      db._listeners = [{ path: 'a' }, { path: 'b' }]
      db.gameRef = { path: 'game' }
      db.playersRef = { path: 'players' }

      db.cleanup()

      expect(mockOff).toHaveBeenCalledTimes(2)
      expect(db._listeners).toEqual([])
      expect(db.gameRef).toBeNull()
      expect(db.playersRef).toBeNull()
    })
  })

  describe('onUserStateChange', () => {
    it('registers auth state listener', () => {
      db.onUserStateChange()
      expect(mockOnAuthStateChanged).toHaveBeenCalled()
    })
  })
})
