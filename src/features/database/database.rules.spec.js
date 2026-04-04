import { describe, it, beforeEach } from 'vitest'
import * as firebase from '@firebase/rules-unit-testing'

const ROOM_ID = 'test-room-123'
const HOST_UID = 'host-user'
const PLAYER_UID = 'player-user'
const OTHER_UID = 'other-user'

function seedGame () {
  return globalThis.adminSeed(`games/${ROOM_ID}`, {
    hostId: HOST_UID,
    status: 'playing',
    currentRound: 0,
    roundStartedAt: Date.now(),
    roundTime: 30,
    totalRounds: 5,
    createdAt: Date.now(),
    rounds: {
      0: { lat: 48.8566, lng: 2.3522, revealed: false },
      1: { lat: 51.5074, lng: -0.1278, country: 'GB', revealed: true }
    },
    players: {
      [HOST_UID]: { name: 'Host', score: 0, joinedAt: Date.now() },
      [PLAYER_UID]: { name: 'Player', score: 0, joinedAt: Date.now() }
    }
  })
}

describe('Database Rules', () => {
  // ── Anonymous users ──────────────────────────────────────────

  describe('Anonymous users', () => {
    let db

    beforeEach(() => {
      db = globalThis.authedApp(null)
    })

    it('Disallow reading root', async () => {
      await firebase.assertFails(db.ref('/').once('value'))
    })

    it('Disallow reading games', async () => {
      await firebase.assertFails(db.ref('games').once('value'))
    })

    it('Disallow reading a specific game field', async () => {
      await firebase.assertFails(db.ref(`games/${ROOM_ID}/status`).once('value'))
    })

    it('Disallow writing anywhere', async () => {
      await firebase.assertFails(db.ref(`games/${ROOM_ID}/status`).set('playing'))
    })

    it('Disallow reading location-pool', async () => {
      await firebase.assertFails(db.ref('location-pool').once('value'))
    })

    it('Disallow writing location-pool', async () => {
      await firebase.assertFails(
        db.ref('location-pool/test').set({ lat: 0, lng: 0, country: 'XX' })
      )
    })
  })

  // ── Authenticated users - game metadata ──────────────────────

  describe('Authenticated users - game metadata', () => {
    let db

    beforeEach(async () => {
      await seedGame()
      db = globalThis.authedApp({ uid: PLAYER_UID })
    })

    it('Can read entire game node', async () => {
      await firebase.assertSucceeds(db.ref(`games/${ROOM_ID}`).once('value'))
    })

    it('Can read hostId', async () => {
      await firebase.assertSucceeds(db.ref(`games/${ROOM_ID}/hostId`).once('value'))
    })

    it('Can read status', async () => {
      await firebase.assertSucceeds(db.ref(`games/${ROOM_ID}/status`).once('value'))
    })

    it('Can read currentRound', async () => {
      await firebase.assertSucceeds(db.ref(`games/${ROOM_ID}/currentRound`).once('value'))
    })

    it('Can read roundStartedAt', async () => {
      await firebase.assertSucceeds(db.ref(`games/${ROOM_ID}/roundStartedAt`).once('value'))
    })

    it('Can read roundTime', async () => {
      await firebase.assertSucceeds(db.ref(`games/${ROOM_ID}/roundTime`).once('value'))
    })

    it('Can read totalRounds', async () => {
      await firebase.assertSucceeds(db.ref(`games/${ROOM_ID}/totalRounds`).once('value'))
    })

    it('Can read createdAt', async () => {
      await firebase.assertSucceeds(db.ref(`games/${ROOM_ID}/createdAt`).once('value'))
    })

    it('Can read finishedAt', async () => {
      await firebase.assertSucceeds(db.ref(`games/${ROOM_ID}/finishedAt`).once('value'))
    })

    it('Cannot write hostId', async () => {
      await firebase.assertFails(db.ref(`games/${ROOM_ID}/hostId`).set('hacked'))
    })

    it('Cannot write status', async () => {
      await firebase.assertFails(db.ref(`games/${ROOM_ID}/status`).set('finished'))
    })

    it('Cannot write currentRound', async () => {
      await firebase.assertFails(db.ref(`games/${ROOM_ID}/currentRound`).set(99))
    })

    it('Cannot write roundStartedAt', async () => {
      await firebase.assertFails(db.ref(`games/${ROOM_ID}/roundStartedAt`).set(0))
    })

    it('Cannot write totalRounds', async () => {
      await firebase.assertFails(db.ref(`games/${ROOM_ID}/totalRounds`).set(100))
    })

    it('Cannot write createdAt', async () => {
      await firebase.assertFails(db.ref(`games/${ROOM_ID}/createdAt`).set(0))
    })

    it('Cannot write finishedAt', async () => {
      await firebase.assertFails(db.ref(`games/${ROOM_ID}/finishedAt`).set(0))
    })
  })

  // ── Players collection ───────────────────────────────────────

  describe('Players collection', () => {
    let db

    beforeEach(async () => {
      await seedGame()
      db = globalThis.authedApp({ uid: PLAYER_UID })
    })

    it('Can read all players', async () => {
      await firebase.assertSucceeds(db.ref(`games/${ROOM_ID}/players`).once('value'))
    })

    it('Can write own name', async () => {
      await firebase.assertSucceeds(
        db.ref(`games/${ROOM_ID}/players/${PLAYER_UID}/name`).set('NewName')
      )
    })

    it('Cannot write to another players node', async () => {
      await firebase.assertFails(
        db.ref(`games/${ROOM_ID}/players/${HOST_UID}/name`).set('Hacked')
      )
    })
  })

  // ── Score tampering prevention ───────────────────────────────

  describe('Score tampering prevention', () => {
    let playerDb, hostDb

    beforeEach(async () => {
      await seedGame()
      playerDb = globalThis.authedApp({ uid: PLAYER_UID })
      hostDb = globalThis.authedApp({ uid: HOST_UID })
    })

    it('Player cannot write their own score', async () => {
      await firebase.assertFails(
        playerDb.ref(`games/${ROOM_ID}/players/${PLAYER_UID}/score`).set(999999)
      )
    })

    it('Player cannot increment their own score', async () => {
      await firebase.assertFails(
        playerDb.ref(`games/${ROOM_ID}/players/${PLAYER_UID}/score`).set(1500)
      )
    })

    it('Host cannot tamper with another players score', async () => {
      await firebase.assertFails(
        hostDb.ref(`games/${ROOM_ID}/players/${PLAYER_UID}/score`).set(0)
      )
    })

    it('Host cannot tamper with their own score', async () => {
      await firebase.assertFails(
        hostDb.ref(`games/${ROOM_ID}/players/${HOST_UID}/score`).set(999999)
      )
    })
  })

  // ── Player name validation ───────────────────────────────────

  describe('Player name validation', () => {
    let db

    beforeEach(async () => {
      await seedGame()
      db = globalThis.authedApp({ uid: PLAYER_UID })
    })

    it('Can set a valid name', async () => {
      await firebase.assertSucceeds(
        db.ref(`games/${ROOM_ID}/players/${PLAYER_UID}/name`).set('ValidName')
      )
    })

    it('Cannot set empty name', async () => {
      await firebase.assertFails(
        db.ref(`games/${ROOM_ID}/players/${PLAYER_UID}/name`).set('')
      )
    })

    it('Cannot set name longer than 32 characters', async () => {
      await firebase.assertFails(
        db.ref(`games/${ROOM_ID}/players/${PLAYER_UID}/name`).set('a'.repeat(33))
      )
    })

    it('Cannot set name to a non-string value', async () => {
      await firebase.assertFails(
        db.ref(`games/${ROOM_ID}/players/${PLAYER_UID}/name`).set(12345)
      )
    })
  })

  // ── joinedAt write-once enforcement ──────────────────────────

  describe('joinedAt write-once enforcement', () => {
    let playerDb, newPlayerDb

    beforeEach(async () => {
      await seedGame()
      playerDb = globalThis.authedApp({ uid: PLAYER_UID })
      newPlayerDb = globalThis.authedApp({ uid: OTHER_UID })
    })

    it('Cannot overwrite existing joinedAt', async () => {
      await firebase.assertFails(
        playerDb.ref(`games/${ROOM_ID}/players/${PLAYER_UID}/joinedAt`).set(Date.now())
      )
    })

    it('New player can set joinedAt', async () => {
      await firebase.assertSucceeds(
        newPlayerDb.ref(`games/${ROOM_ID}/players/${OTHER_UID}/joinedAt`).set(Date.now())
      )
    })

    it('joinedAt must be a number', async () => {
      await firebase.assertFails(
        newPlayerDb.ref(`games/${ROOM_ID}/players/${OTHER_UID}/joinedAt`).set('not-a-number')
      )
    })
  })

  // ── Guesses - write-once enforcement ─────────────────────────

  describe('Guesses - write-once enforcement', () => {
    let playerDb

    beforeEach(async () => {
      await seedGame()
      playerDb = globalThis.authedApp({ uid: PLAYER_UID })
    })

    it('Can submit a guess for own player', async () => {
      await firebase.assertSucceeds(
        playerDb.ref(`games/${ROOM_ID}/players/${PLAYER_UID}/guesses/0`).set({
          lat: 48.8566,
          lng: 2.3522,
          timestamp: Date.now(),
          score: 3000
        })
      )
    })

    it('Cannot submit a guess for another player', async () => {
      await firebase.assertFails(
        playerDb.ref(`games/${ROOM_ID}/players/${HOST_UID}/guesses/0`).set({
          lat: 48.8566,
          lng: 2.3522,
          timestamp: Date.now(),
          score: 3000
        })
      )
    })

    it('Cannot overwrite an existing guess', async () => {
      await firebase.assertSucceeds(
        playerDb.ref(`games/${ROOM_ID}/players/${PLAYER_UID}/guesses/0`).set({
          lat: 48.8566,
          lng: 2.3522,
          timestamp: Date.now(),
          score: 3000
        })
      )

      await firebase.assertFails(
        playerDb.ref(`games/${ROOM_ID}/players/${PLAYER_UID}/guesses/0`).set({
          lat: 51.5074,
          lng: -0.1278,
          timestamp: Date.now(),
          score: 4000
        })
      )
    })

    it('Guess must have lat, lng, timestamp and score', async () => {
      await firebase.assertFails(
        playerDb.ref(`games/${ROOM_ID}/players/${PLAYER_UID}/guesses/0`).set({
          lat: 48.8566,
          lng: 2.3522
        })
      )

      await firebase.assertFails(
        playerDb.ref(`games/${ROOM_ID}/players/${PLAYER_UID}/guesses/0`).set({
          timestamp: Date.now(),
          score: 3000
        })
      )
    })

    it('Cannot submit guess with extra fields only', async () => {
      await firebase.assertFails(
        playerDb.ref(`games/${ROOM_ID}/players/${PLAYER_UID}/guesses/0`).set({
          score: 1500,
          correct: true
        })
      )
    })
  })

  // ── Rounds - country answer visibility ───────────────────────

  describe('Rounds - country answer visibility', () => {
    let db

    beforeEach(async () => {
      await seedGame()
      db = globalThis.authedApp({ uid: PLAYER_UID })
    })

    it('Can read lat of a round', async () => {
      await firebase.assertSucceeds(db.ref(`games/${ROOM_ID}/rounds/0/lat`).once('value'))
    })

    it('Can read lng of a round', async () => {
      await firebase.assertSucceeds(db.ref(`games/${ROOM_ID}/rounds/0/lng`).once('value'))
    })

    it('Can read revealed flag', async () => {
      await firebase.assertSucceeds(db.ref(`games/${ROOM_ID}/rounds/0/revealed`).once('value'))
    })

    it('Country field absent on unrevealed round', async () => {
      const snap = await db.ref(`games/${ROOM_ID}/rounds/0/country`).once('value')
      firebase.assertSucceeds(Promise.resolve(snap))
      // Country is not stored until revealed — snapshot is null
      if (snap.val() !== null) throw new Error('Expected null for unrevealed round country')
    })

    it('Can read country when round IS revealed', async () => {
      await firebase.assertSucceeds(db.ref(`games/${ROOM_ID}/rounds/1/country`).once('value'))
    })

    it('Cannot write to round data', async () => {
      await firebase.assertFails(db.ref(`games/${ROOM_ID}/rounds/0/revealed`).set(true))
    })

    it('Cannot write country answer', async () => {
      await firebase.assertFails(db.ref(`games/${ROOM_ID}/rounds/0/country`).set('XX'))
    })
  })

  // ── Game answers isolation ───────────────────────────────────

  describe('Game answers isolation', () => {
    let db

    beforeEach(() => {
      db = globalThis.authedApp({ uid: PLAYER_UID })
    })

    it('Authenticated user cannot read game-answers', async () => {
      await firebase.assertFails(db.ref(`game-answers/${ROOM_ID}`).once('value'))
    })

    it('Authenticated user cannot write to game-answers', async () => {
      await firebase.assertFails(
        db.ref(`game-answers/${ROOM_ID}/0`).set('XX')
      )
    })
  })

  // ── Location pool isolation ──────────────────────────────────

  describe('Location pool isolation', () => {
    let db

    beforeEach(() => {
      db = globalThis.authedApp({ uid: PLAYER_UID })
    })

    it('Authenticated user cannot read location-pool', async () => {
      await firebase.assertFails(db.ref('location-pool').once('value'))
    })

    it('Authenticated user cannot write to location-pool', async () => {
      await firebase.assertFails(
        db.ref('location-pool/injected').set({ lat: 0, lng: 0, country: 'XX', addedAt: Date.now() })
      )
    })

    it('Authenticated user cannot delete from location-pool', async () => {
      await firebase.assertFails(db.ref('location-pool').remove())
    })
  })

  // ── Root-level security ──────────────────────────────────────

  describe('Root-level security', () => {
    let db

    beforeEach(() => {
      db = globalThis.authedApp({ uid: PLAYER_UID })
    })

    it('Cannot read root', async () => {
      await firebase.assertFails(db.ref('/').once('value'))
    })

    it('Cannot write to root', async () => {
      await firebase.assertFails(db.ref('/').set({ hacked: true }))
    })

    it('Cannot write to arbitrary paths', async () => {
      await firebase.assertFails(db.ref('arbitrary/path').set('data'))
    })

    it('Cannot create a new game directly (only via Cloud Functions)', async () => {
      await firebase.assertFails(
        db.ref('games/new-room').set({
          hostId: PLAYER_UID,
          status: 'waiting',
          currentRound: 0
        })
      )
    })
  })

  // ── Cross-player isolation ───────────────────────────────────

  describe('Cross-player isolation', () => {
    let hostDb, playerDb, otherDb

    beforeEach(async () => {
      await seedGame()
      hostDb = globalThis.authedApp({ uid: HOST_UID })
      playerDb = globalThis.authedApp({ uid: PLAYER_UID })
      otherDb = globalThis.authedApp({ uid: OTHER_UID })
    })

    it('Host cannot tamper with game status directly', async () => {
      await firebase.assertFails(hostDb.ref(`games/${ROOM_ID}/status`).set('finished'))
    })

    it('Host cannot tamper with scores of other players', async () => {
      await firebase.assertFails(
        hostDb.ref(`games/${ROOM_ID}/players/${PLAYER_UID}/score`).set(0)
      )
    })

    it('Player cannot submit guess as another player', async () => {
      await firebase.assertFails(
        playerDb.ref(`games/${ROOM_ID}/players/${HOST_UID}/guesses/0`).set({
          lat: 0,
          lng: 0,
          timestamp: Date.now(),
          score: 0
        })
      )
    })

    it('Non-participant can still read game state (authenticated)', async () => {
      await firebase.assertSucceeds(otherDb.ref(`games/${ROOM_ID}/status`).once('value'))
    })

    it('Non-participant cannot write to any player node', async () => {
      await firebase.assertFails(
        otherDb.ref(`games/${ROOM_ID}/players/${HOST_UID}/name`).set('Hacked')
      )
    })

    it('Non-participant cannot write guesses for existing players', async () => {
      await firebase.assertFails(
        otherDb.ref(`games/${ROOM_ID}/players/${PLAYER_UID}/guesses/0`).set({
          lat: 0,
          lng: 0,
          timestamp: Date.now(),
          score: 0
        })
      )
    })
  })
})
