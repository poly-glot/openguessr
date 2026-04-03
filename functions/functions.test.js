import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { getApp, deleteApp } from 'firebase-admin/app'
import functionsTest from 'firebase-functions-test'
import { login, createGame, joinGame, submitGuess, submitMiss, nextRound, startGame } from './index.js'

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

  describe('login', () => {
    let loginFunction

    beforeEach(() => {
      loginFunction = test.wrap(login)
    })

    it('should throw when username is empty', async () => {
      await expect(loginFunction({ data: { username: null } })).rejects.toThrow()
    })

    it('should throw when username exceeds 32 characters', async () => {
      await expect(loginFunction({ data: { username: 'a'.repeat(64) } })).rejects.toThrow()
    })

    it('should throw when username contains special characters', async () => {
      await expect(loginFunction({ data: { username: 'name!' } })).rejects.toThrow()
    })

    it('should return a token for valid username', async () => {
      await expect(loginFunction({ data: { username: 'player1' } })).resolves.toEqual(
        expect.objectContaining({
          token: expect.any(String),
          uid: expect.any(String)
        })
      )
    })
  })

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
        auth: { uid: 'host-user' },
        data: { username: 'Host' }
      })
      expect(result).toEqual(
        expect.objectContaining({
          roomId: expect.any(String),
          token: expect.any(String)
        })
      )
    })
  })

  describe('joinGame', () => {
    let createGameFunction
    let joinGameFunction

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
        auth: { uid: 'host2' },
        data: { username: 'Host' }
      })

      const result = await joinGameFunction({
        auth: { uid: 'player2' },
        data: { roomId, username: 'Player2' }
      })

      expect(result).toEqual(
        expect.objectContaining({
          status: expect.any(String),
          totalRounds: 5
        })
      )
    })
  })

  describe('submitGuess', () => {
    let createGameFunction
    let startGameFunction
    let submitGuessFunction

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
        auth: { uid: 'host3' },
        data: { username: 'Host' }
      })

      await expect(
        submitGuessFunction({
          auth: { uid: 'host3' },
          data: { roomId, round: 0, countryCode: 'US' }
        })
      ).rejects.toThrow()
    })
  })

  describe('submitMiss', () => {
    let createGameFunction
    let startGameFunction
    let submitMissFunction

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
        auth: { uid: 'host5' },
        data: { username: 'Host' }
      })

      await startGameFunction({
        auth: { uid: 'host5' },
        data: { roomId }
      })

      const result = await submitMissFunction({
        auth: { uid: 'host5' },
        data: { roomId, round: 0 }
      })

      expect(result).toEqual({ score: 0, correct: false })
    })
  })

  describe('nextRound', () => {
    let createGameFunction
    let nextRoundFunction

    beforeEach(() => {
      createGameFunction = test.wrap(createGame)
      nextRoundFunction = test.wrap(nextRound)
    })

    it('should throw when user is not the host', async () => {
      const { roomId } = await createGameFunction({
        auth: { uid: 'host4' },
        data: { username: 'Host' }
      })

      await expect(
        nextRoundFunction({ auth: { uid: 'other-user' }, data: { roomId } })
      ).rejects.toThrow()
    })
  })
})
