import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { getApp, deleteApp } from 'firebase-admin/app'
import { getDatabase } from 'firebase-admin/database'
import functionsTest from 'firebase-functions-test'
import { login, createGame, joinGame, submitGuess, submitMiss, nextRound, startGame, transferHost } from './index.js'

const test = functionsTest()

describe('Firebase Cloud Functions', () => {
  afterAll(async () => {
    test.cleanup()
    try {
      const app = getApp()
      await deleteApp(app)
    } catch (e) {
      // App may not exist
    }
  })

  // ── login ────────────────────────────────────────────────────

  describe('login', () => {
    let loginFunction

    beforeEach(() => {
      loginFunction = test.wrap(login)
    })

    it('should throw when username is empty', async () => {
      await expect(loginFunction({ data: { username: null } })).rejects.toThrow()
    })

    it('should throw when username is undefined', async () => {
      await expect(loginFunction({ data: {} })).rejects.toThrow()
    })

    it('should throw when username exceeds 32 characters', async () => {
      await expect(loginFunction({ data: { username: 'a'.repeat(64) } })).rejects.toThrow()
    })

    it('should throw when username contains special characters', async () => {
      await expect(loginFunction({ data: { username: 'name!' } })).rejects.toThrow()
    })

    it('should throw when username contains angle brackets', async () => {
      await expect(loginFunction({ data: { username: '<script>' } })).rejects.toThrow()
    })

    it('should return a token for valid username', async () => {
      await expect(loginFunction({ data: { username: 'player1' } })).resolves.toEqual(
        expect.objectContaining({
          token: expect.any(String),
          uid: expect.any(String)
        })
      )
    })

    it('should allow spaces and hyphens in username', async () => {
      await expect(loginFunction({ data: { username: 'my-player name' } })).resolves.toEqual(
        expect.objectContaining({ token: expect.any(String) })
      )
    })

    it('should generate uid from username', async () => {
      const result = await loginFunction({ data: { username: 'Test User' } })
      expect(result.uid).toMatch(/^test-user-[a-f0-9-]+$/)
    })
  })

  // ── createGame ───────────────────────────────────────────────

  describe('createGame', () => {
    let createGameFunction

    beforeEach(() => {
      createGameFunction = test.wrap(createGame)
    })

    it('should throw when user is not logged in', async () => {
      await expect(createGameFunction({ auth: null })).rejects.toThrow()
    })

    it('should create a game and return roomId and token', async () => {
      const result = await createGameFunction({
        auth: { uid: 'host-create-1' },
        data: { username: 'Host' }
      })
      expect(result).toEqual(
        expect.objectContaining({
          roomId: expect.any(String),
          token: expect.any(String)
        })
      )
    })

    it('should create game with 5 rounds', async () => {
      const { roomId } = await createGameFunction({
        auth: { uid: 'host-create-2' },
        data: { username: 'Host' }
      })

      const db = getDatabase()
      const snapshot = await db.ref(`games/${roomId}`).get()
      const game = snapshot.val()

      expect(game.totalRounds).toBe(5)
      expect(game.roundTime).toBe(30)
      expect(game.status).toBe('waiting')
      expect(game.currentRound).toBe(0)
      expect(game.hostId).toBe('host-create-2')
      expect(Object.keys(game.rounds)).toHaveLength(5)
    })

    it('should include host as first player', async () => {
      const { roomId } = await createGameFunction({
        auth: { uid: 'host-create-3' },
        data: { username: 'HostName' }
      })

      const db = getDatabase()
      const snapshot = await db.ref(`games/${roomId}/players/host-create-3`).get()
      const player = snapshot.val()

      expect(player.name).toBe('HostName')
      expect(player.score).toBe(0)
      expect(player.joinedAt).toEqual(expect.any(Number))
    })

    it('each round should have lat, lng, and revealed=false; country stored in game-answers', async () => {
      const { roomId } = await createGameFunction({
        auth: { uid: 'host-create-4' },
        data: { username: 'Host' }
      })

      const db = getDatabase()
      const snapshot = await db.ref(`games/${roomId}/rounds/0`).get()
      const round = snapshot.val()

      expect(round).toEqual(expect.objectContaining({
        lat: expect.any(Number),
        lng: expect.any(Number),
        revealed: false
      }))
      expect(round.country).toBeUndefined()

      const answerSnap = await db.ref(`game-answers/${roomId}/0`).get()
      expect(answerSnap.val()).toMatch(/^[A-Z]{2}$/)
    })
  })

  // ── joinGame ─────────────────────────────────────────────────

  describe('joinGame', () => {
    let createGameFunction, joinGameFunction

    beforeEach(() => {
      createGameFunction = test.wrap(createGame)
      joinGameFunction = test.wrap(joinGame)
    })

    it('should throw when user is not logged in', async () => {
      await expect(joinGameFunction({ auth: null, data: { roomId: 'test' } })).rejects.toThrow()
    })

    it('should throw when roomId is missing', async () => {
      await expect(joinGameFunction({ auth: { uid: 'user1' }, data: {} })).rejects.toThrow()
    })

    it('should throw when game does not exist', async () => {
      await expect(
        joinGameFunction({ auth: { uid: 'user1' }, data: { roomId: 'nonexistent' } })
      ).rejects.toThrow()
    })

    it('should join an existing game', async () => {
      const { roomId } = await createGameFunction({
        auth: { uid: 'host-join-1' },
        data: { username: 'Host' }
      })

      const result = await joinGameFunction({
        auth: { uid: 'player-join-1' },
        data: { roomId, username: 'Player1' }
      })

      expect(result).toEqual(
        expect.objectContaining({
          status: 'waiting',
          totalRounds: 5
        })
      )
    })

    it('should be idempotent for existing player', async () => {
      const { roomId } = await createGameFunction({
        auth: { uid: 'host-join-2' },
        data: { username: 'Host' }
      })

      await joinGameFunction({
        auth: { uid: 'player-join-2' },
        data: { roomId, username: 'Player' }
      })

      // Join again — should not throw
      const result = await joinGameFunction({
        auth: { uid: 'player-join-2' },
        data: { roomId, username: 'Player' }
      })

      expect(result.status).toBe('waiting')
    })
  })

  // ── startGame ────────────────────────────────────────────────

  describe('startGame', () => {
    let createGameFunction, startGameFunction

    beforeEach(() => {
      createGameFunction = test.wrap(createGame)
      startGameFunction = test.wrap(startGame)
    })

    it('should throw when user is not logged in', async () => {
      await expect(startGameFunction({ auth: null, data: { roomId: 'test' } })).rejects.toThrow()
    })

    it('should throw when non-host tries to start', async () => {
      const { roomId } = await createGameFunction({
        auth: { uid: 'host-start-1' },
        data: { username: 'Host' }
      })

      await expect(
        startGameFunction({ auth: { uid: 'other-user' }, data: { roomId } })
      ).rejects.toThrow()
    })

    it('should transition game to playing state', async () => {
      const { roomId } = await createGameFunction({
        auth: { uid: 'host-start-2' },
        data: { username: 'Host' }
      })

      const result = await startGameFunction({
        auth: { uid: 'host-start-2' },
        data: { roomId }
      })

      expect(result).toEqual({ status: 'playing', round: 0 })
    })

    it('should set roundStartedAt timestamp', async () => {
      const { roomId } = await createGameFunction({
        auth: { uid: 'host-start-3' },
        data: { username: 'Host' }
      })

      const before = Date.now()
      await startGameFunction({ auth: { uid: 'host-start-3' }, data: { roomId } })

      const db = getDatabase()
      const snapshot = await db.ref(`games/${roomId}/roundStartedAt`).get()
      const roundStartedAt = snapshot.val()

      expect(roundStartedAt).toBeGreaterThanOrEqual(before)
      expect(roundStartedAt).toBeLessThanOrEqual(Date.now())
    })
  })

  // ── submitGuess ──────────────────────────────────────────────

  describe('submitGuess', () => {
    let createGameFunction, startGameFunction, submitGuessFunction

    beforeEach(() => {
      createGameFunction = test.wrap(createGame)
      startGameFunction = test.wrap(startGame)
      submitGuessFunction = test.wrap(submitGuess)
    })

    it('should throw when user is not logged in', async () => {
      await expect(
        submitGuessFunction({ auth: null, data: { roomId: 'test', round: 0, countryCode: 'US' } })
      ).rejects.toThrow()
    })

    it('should throw when game is not in playing state', async () => {
      const { roomId } = await createGameFunction({
        auth: { uid: 'host-guess-1' },
        data: { username: 'Host' }
      })

      await expect(
        submitGuessFunction({
          auth: { uid: 'host-guess-1' },
          data: { roomId, round: 0, countryCode: 'US' }
        })
      ).rejects.toThrow()
    })

    it('should return max score (5000) and distanceKm=0 for exact guess', async () => {
      const { roomId } = await createGameFunction({
        auth: { uid: 'host-guess-2' },
        data: { username: 'Host' }
      })

      await startGameFunction({ auth: { uid: 'host-guess-2' }, data: { roomId } })

      // Read the actual coordinates for round 0
      const db = getDatabase()
      const roundSnap = await db.ref(`games/${roomId}/rounds/0`).get()
      const { lat, lng } = roundSnap.val()

      const result = await submitGuessFunction({
        auth: { uid: 'host-guess-2' },
        data: { roomId, round: 0, lat, lng }
      })

      expect(result.score).toBe(5000)
      expect(result.distanceKm).toBe(0)
      expect(result.answerLat).toBe(lat)
      expect(result.answerLng).toBe(lng)
    })

    it('should return low score for a guess far from the answer', async () => {
      const { roomId } = await createGameFunction({
        auth: { uid: 'host-guess-3' },
        data: { username: 'Host' }
      })

      await startGameFunction({ auth: { uid: 'host-guess-3' }, data: { roomId } })

      // Guess at the opposite side of the globe (roughly)
      const db = getDatabase()
      const roundSnap = await db.ref(`games/${roomId}/rounds/0`).get()
      const { lat, lng } = roundSnap.val()
      const antipodeLat = -lat
      const antipodeLng = lng > 0 ? lng - 180 : lng + 180

      const result = await submitGuessFunction({
        auth: { uid: 'host-guess-3' },
        data: { roomId, round: 0, lat: antipodeLat, lng: antipodeLng }
      })

      expect(result.score).toBeLessThan(100)
      expect(result.distanceKm).toBeGreaterThan(15000)
    })

    it('should reject guess with invalid coordinates', async () => {
      const { roomId } = await createGameFunction({
        auth: { uid: 'host-guess-invalid' },
        data: { username: 'Host' }
      })

      await startGameFunction({ auth: { uid: 'host-guess-invalid' }, data: { roomId } })

      await expect(
        submitGuessFunction({
          auth: { uid: 'host-guess-invalid' },
          data: { roomId, round: 0, lat: 200, lng: 0 }
        })
      ).rejects.toThrow()
    })

    it('should reject duplicate guess for same round', async () => {
      const { roomId } = await createGameFunction({
        auth: { uid: 'host-guess-4' },
        data: { username: 'Host' }
      })

      await startGameFunction({ auth: { uid: 'host-guess-4' }, data: { roomId } })

      await submitGuessFunction({
        auth: { uid: 'host-guess-4' },
        data: { roomId, round: 0, lat: 0, lng: 0 }
      })

      await expect(
        submitGuessFunction({
          auth: { uid: 'host-guess-4' },
          data: { roomId, round: 0, lat: 10, lng: 10 }
        })
      ).rejects.toThrow()
    })

    it('should reject guess for wrong round number', async () => {
      const { roomId } = await createGameFunction({
        auth: { uid: 'host-guess-5' },
        data: { username: 'Host' }
      })

      await startGameFunction({ auth: { uid: 'host-guess-5' }, data: { roomId } })

      await expect(
        submitGuessFunction({
          auth: { uid: 'host-guess-5' },
          data: { roomId, round: 3, lat: 0, lng: 0 }
        })
      ).rejects.toThrow()
    })

    it('should accumulate score across rounds', async () => {
      const { roomId } = await createGameFunction({
        auth: { uid: 'host-guess-6' },
        data: { username: 'Host' }
      })

      await startGameFunction({ auth: { uid: 'host-guess-6' }, data: { roomId } })

      const db = getDatabase()
      const round0Snap = await db.ref(`games/${roomId}/rounds/0`).get()
      const round0 = round0Snap.val()

      const result1 = await submitGuessFunction({
        auth: { uid: 'host-guess-6' },
        data: { roomId, round: 0, lat: round0.lat, lng: round0.lng }
      })

      const nextRoundFunction = test.wrap(nextRound)
      await nextRoundFunction({ auth: { uid: 'host-guess-6' }, data: { roomId } })

      const round1Snap = await db.ref(`games/${roomId}/rounds/1`).get()
      const round1 = round1Snap.val()

      const result2 = await submitGuessFunction({
        auth: { uid: 'host-guess-6' },
        data: { roomId, round: 1, lat: round1.lat, lng: round1.lng }
      })

      const playerSnap = await db.ref(`games/${roomId}/players/host-guess-6/score`).get()
      const totalScore = playerSnap.val()

      expect(totalScore).toBe(result1.score + result2.score)
    })
  })

  // ── submitMiss ───────────────────────────────────────────────

  describe('submitMiss', () => {
    let createGameFunction, startGameFunction, submitMissFunction

    beforeEach(() => {
      createGameFunction = test.wrap(createGame)
      startGameFunction = test.wrap(startGame)
      submitMissFunction = test.wrap(submitMiss)
    })

    it('should throw when user is not logged in', async () => {
      await expect(
        submitMissFunction({ auth: null, data: { roomId: 'test', round: 0 } })
      ).rejects.toThrow()
    })

    it('should record a miss for a playing game', async () => {
      const { roomId } = await createGameFunction({
        auth: { uid: 'host-miss-1' },
        data: { username: 'Host' }
      })

      await startGameFunction({ auth: { uid: 'host-miss-1' }, data: { roomId } })

      const result = await submitMissFunction({
        auth: { uid: 'host-miss-1' },
        data: { roomId, round: 0 }
      })

      expect(result).toEqual({ score: 0, distanceKm: null })
    })

    it('should be idempotent if already guessed', async () => {
      const { roomId } = await createGameFunction({
        auth: { uid: 'host-miss-2' },
        data: { username: 'Host' }
      })

      await startGameFunction({ auth: { uid: 'host-miss-2' }, data: { roomId } })

      const submitGuessFunction = test.wrap(submitGuess)
      await submitGuessFunction({
        auth: { uid: 'host-miss-2' },
        data: { roomId, round: 0, lat: 0, lng: 0 }
      })

      // submitMiss after already guessing should return 0 without error
      const result = await submitMissFunction({
        auth: { uid: 'host-miss-2' },
        data: { roomId, round: 0 }
      })

      expect(result).toEqual({ score: 0, distanceKm: null })
    })
  })

  // ── nextRound ────────────────────────────────────────────────

  describe('nextRound', () => {
    let createGameFunction, startGameFunction, nextRoundFunction

    beforeEach(() => {
      createGameFunction = test.wrap(createGame)
      startGameFunction = test.wrap(startGame)
      nextRoundFunction = test.wrap(nextRound)
    })

    it('should throw when user is not the host', async () => {
      const { roomId } = await createGameFunction({
        auth: { uid: 'host-next-1' },
        data: { username: 'Host' }
      })

      await expect(
        nextRoundFunction({ auth: { uid: 'other-user' }, data: { roomId } })
      ).rejects.toThrow()
    })

    it('should advance to next round', async () => {
      const { roomId } = await createGameFunction({
        auth: { uid: 'host-next-2' },
        data: { username: 'Host' }
      })

      await startGameFunction({ auth: { uid: 'host-next-2' }, data: { roomId } })

      const result = await nextRoundFunction({
        auth: { uid: 'host-next-2' },
        data: { roomId }
      })

      expect(result).toEqual({ status: 'playing', round: 1 })
    })

    it('should reveal current round answer after advancing', async () => {
      const { roomId } = await createGameFunction({
        auth: { uid: 'host-next-3' },
        data: { username: 'Host' }
      })

      await startGameFunction({ auth: { uid: 'host-next-3' }, data: { roomId } })
      await nextRoundFunction({ auth: { uid: 'host-next-3' }, data: { roomId } })

      const db = getDatabase()
      const snapshot = await db.ref(`games/${roomId}/rounds/0/revealed`).get()
      expect(snapshot.val()).toBe(true)
    })

    it('should finish game after final round', async () => {
      const { roomId } = await createGameFunction({
        auth: { uid: 'host-next-4' },
        data: { username: 'Host' }
      })

      await startGameFunction({ auth: { uid: 'host-next-4' }, data: { roomId } })

      // Advance through all 5 rounds
      for (let i = 0; i < 4; i++) {
        await nextRoundFunction({ auth: { uid: 'host-next-4' }, data: { roomId } })
      }

      // 5th nextRound should finish the game
      const result = await nextRoundFunction({
        auth: { uid: 'host-next-4' },
        data: { roomId }
      })

      expect(result.status).toBe('finished')
    })

    it('should set finishedAt timestamp when game ends', async () => {
      const { roomId } = await createGameFunction({
        auth: { uid: 'host-next-5' },
        data: { username: 'Host' }
      })

      await startGameFunction({ auth: { uid: 'host-next-5' }, data: { roomId } })

      for (let i = 0; i < 5; i++) {
        await nextRoundFunction({ auth: { uid: 'host-next-5' }, data: { roomId } })
      }

      const db = getDatabase()
      const snapshot = await db.ref(`games/${roomId}/finishedAt`).get()
      expect(snapshot.val()).toEqual(expect.any(Number))
    })
  })

  // ── transferHost ─────────────────────────────────────────────

  describe('transferHost', () => {
    let createGameFunction, joinGameFunction, transferHostFunction

    beforeEach(() => {
      createGameFunction = test.wrap(createGame)
      joinGameFunction = test.wrap(joinGame)
      transferHostFunction = test.wrap(transferHost)
    })

    it('should throw when user is not logged in', async () => {
      await expect(
        transferHostFunction({ auth: null, data: { roomId: 'test', targetUid: 'x' } })
      ).rejects.toThrow()
    })

    it('should throw when non-host tries to transfer', async () => {
      const { roomId } = await createGameFunction({
        auth: { uid: 'host-transfer-1' },
        data: { username: 'Host' }
      })

      await joinGameFunction({
        auth: { uid: 'player-transfer-1' },
        data: { roomId, username: 'Player' }
      })

      await expect(
        transferHostFunction({
          auth: { uid: 'player-transfer-1' },
          data: { roomId, targetUid: 'player-transfer-1' }
        })
      ).rejects.toThrow()
    })

    it('should throw when target player is not in game', async () => {
      const { roomId } = await createGameFunction({
        auth: { uid: 'host-transfer-2' },
        data: { username: 'Host' }
      })

      await expect(
        transferHostFunction({
          auth: { uid: 'host-transfer-2' },
          data: { roomId, targetUid: 'nonexistent' }
        })
      ).rejects.toThrow()
    })

    it('should transfer host role to target player', async () => {
      const { roomId } = await createGameFunction({
        auth: { uid: 'host-transfer-3' },
        data: { username: 'Host' }
      })

      await joinGameFunction({
        auth: { uid: 'player-transfer-3' },
        data: { roomId, username: 'Player' }
      })

      const result = await transferHostFunction({
        auth: { uid: 'host-transfer-3' },
        data: { roomId, targetUid: 'player-transfer-3' }
      })

      expect(result).toEqual({ success: true, newHostId: 'player-transfer-3' })

      const db = getDatabase()
      const snapshot = await db.ref(`games/${roomId}/hostId`).get()
      expect(snapshot.val()).toBe('player-transfer-3')
    })
  })
})
