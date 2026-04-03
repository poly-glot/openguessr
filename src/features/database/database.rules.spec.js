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
      0: { lat: 48.8566, lng: 2.3522, country: 'FR', revealed: false },
      1: { lat: 51.5074, lng: -0.1278, country: 'GB', revealed: true }
    },
    players: {
      [HOST_UID]: { name: 'Host', score: 0, joinedAt: Date.now() },
      [PLAYER_UID]: { name: 'Player', score: 0, joinedAt: Date.now() }
    }
  })
}

describe('Database Rules', () => {
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
  })

  describe('Authenticated users - game metadata', () => {
    let db

    beforeEach(async () => {
      await seedGame()
      db = globalThis.authedApp({ uid: PLAYER_UID })
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
  })

  describe('Players collection', () => {
    let db

    beforeEach(async () => {
      await seedGame()
      db = globalThis.authedApp({ uid: PLAYER_UID })
    })

    it('Can read all players', async () => {
      await firebase.assertSucceeds(db.ref(`games/${ROOM_ID}/players`).once('value'))
    })

    it('Can write to own player node', async () => {
      await firebase.assertSucceeds(
        db.ref(`games/${ROOM_ID}/players/${PLAYER_UID}`).set({
          name: 'Updated',
          score: 0,
          joinedAt: Date.now()
        })
      )
    })

    it('Cannot write to another players node', async () => {
      await firebase.assertFails(
        db.ref(`games/${ROOM_ID}/players/${HOST_UID}`).set({
          name: 'Hacked',
          score: 9999,
          joinedAt: Date.now()
        })
      )
    })
  })

  describe('Guesses - write-once enforcement', () => {
    let playerDb

    beforeEach(async () => {
      await seedGame()
      playerDb = globalThis.authedApp({ uid: PLAYER_UID })
    })

    it('Can submit a guess for own player', async () => {
      await firebase.assertSucceeds(
        playerDb.ref(`games/${ROOM_ID}/players/${PLAYER_UID}/guesses/0`).set({
          countryCode: 'FR',
          timestamp: Date.now()
        })
      )
    })

    it('Cannot submit a guess for another player', async () => {
      await firebase.assertFails(
        playerDb.ref(`games/${ROOM_ID}/players/${HOST_UID}/guesses/0`).set({
          countryCode: 'FR',
          timestamp: Date.now()
        })
      )
    })

    it('Cannot overwrite an existing guess', async () => {
      // First guess should succeed
      await firebase.assertSucceeds(
        playerDb.ref(`games/${ROOM_ID}/players/${PLAYER_UID}/guesses/0`).set({
          countryCode: 'FR',
          timestamp: Date.now()
        })
      )

      // Second guess for same round should fail
      await firebase.assertFails(
        playerDb.ref(`games/${ROOM_ID}/players/${PLAYER_UID}/guesses/0`).set({
          countryCode: 'GB',
          timestamp: Date.now()
        })
      )
    })

    it('Guess must have countryCode and timestamp', async () => {
      await firebase.assertFails(
        playerDb.ref(`games/${ROOM_ID}/players/${PLAYER_UID}/guesses/0`).set({
          countryCode: 'FR'
        })
      )

      await firebase.assertFails(
        playerDb.ref(`games/${ROOM_ID}/players/${PLAYER_UID}/guesses/0`).set({
          timestamp: Date.now()
        })
      )
    })
  })

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

    it('Cannot read country when round is NOT revealed', async () => {
      await firebase.assertFails(db.ref(`games/${ROOM_ID}/rounds/0/country`).once('value'))
    })

    it('Can read country when round IS revealed', async () => {
      await firebase.assertSucceeds(db.ref(`games/${ROOM_ID}/rounds/1/country`).once('value'))
    })
  })

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
          countryCode: 'XX',
          timestamp: Date.now()
        })
      )
    })

    it('Non-participant can still read game state (authenticated)', async () => {
      await firebase.assertSucceeds(otherDb.ref(`games/${ROOM_ID}/status`).once('value'))
    })

    it('Non-participant cannot write to any player node', async () => {
      await firebase.assertFails(
        otherDb.ref(`games/${ROOM_ID}/players/${HOST_UID}`).set({
          name: 'Hacked',
          score: 0,
          joinedAt: Date.now()
        })
      )
    })
  })
})
