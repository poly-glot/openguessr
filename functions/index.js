const { onCall, HttpsError } = require('firebase-functions/v2/https')
const { onSchedule } = require('firebase-functions/v2/scheduler')
const { defineSecret } = require('firebase-functions/params')
const { initializeApp } = require('firebase-admin/app')

const googleMapsApiKey = defineSecret('GOOGLE_MAPS_API_KEY')
const { getAuth } = require('firebase-admin/auth')
const { getDatabase } = require('firebase-admin/database')
const { v4: uuid } = require('uuid')
const { locations } = require('./locations')
const { generateLocations, shuffleArray } = require('./gemini')

initializeApp()

const isEmulator = process.env.FUNCTIONS_EMULATOR === 'true'
const emulatorDbUrl = 'http://localhost:9001?ns=demo-openguessr'

function db () {
  return isEmulator ? getDatabase(undefined, emulatorDbUrl) : getDatabase()
}

const region = 'us-central1'
const TOTAL_ROUNDS = 5
const ROUND_TIME = 30

const validUsernamePattern = /^[a-z\d\-_\s]+$/i

exports.login = onCall(
  { enforceAppCheck: false, region },
  async (request) => {
    const { username } = request.data

    if (!username || username.length > 32 || !validUsernamePattern.test(username)) {
      throw new HttpsError('failed-precondition', 'Invalid username. Username should be less than 32 characters and contain alphanumeric & space characters only.')
    }

    const uid = username.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now()
    const token = await getAuth().createCustomToken(uid)

    return { token, uid }
  }
)

exports.createGame = onCall(
  { enforceAppCheck: false, region },
  async (request) => {
    const uid = request.auth?.uid
    if (!uid) {
      throw new HttpsError('unauthenticated', 'You are not logged in')
    }

    const roomId = uuid()

    // Pick 5 random locations from AI-generated pool, falling back to static list
    const selected = await pickLocationsFromPool(db(), TOTAL_ROUNDS)

    const rounds = {}
    for (let i = 0; i < TOTAL_ROUNDS; i++) {
      rounds[i] = {
        lat: selected[i].lat,
        lng: selected[i].lng,
        country: selected[i].country,
        revealed: false
      }
    }

    const gameData = {
      hostId: uid,
      status: 'waiting',
      currentRound: 0,
      roundStartedAt: null,
      roundTime: ROUND_TIME,
      totalRounds: TOTAL_ROUNDS,
      rounds,
      players: {
        [uid]: {
          name: request.data?.username || uid,
          score: 0,
          joinedAt: Date.now()
        }
      },
      createdAt: Date.now()
    }

    const database = db()
    await database.ref(`games/${roomId}`).set(gameData)

    const token = await getAuth().createCustomToken(uid, { roomHost: roomId })

    return { roomId, token }
  }
)

exports.joinGame = onCall(
  { enforceAppCheck: false, region },
  async (request) => {
    const uid = request.auth?.uid
    if (!uid) {
      throw new HttpsError('unauthenticated', 'You are not logged in')
    }

    const { roomId, username } = request.data
    if (!roomId) {
      throw new HttpsError('invalid-argument', 'roomId is required')
    }

    const database = db()
    const gameRef = database.ref(`games/${roomId}`)
    const snapshot = await gameRef.get()

    if (!snapshot.exists()) {
      throw new HttpsError('not-found', 'Game not found')
    }

    const game = snapshot.val()

    // Add player if not already present
    if (!game.players || !game.players[uid]) {
      await gameRef.child(`players/${uid}`).set({
        name: username || uid,
        score: 0,
        joinedAt: Date.now()
      })
    }

    return {
      status: game.status,
      currentRound: game.currentRound,
      totalRounds: game.totalRounds
    }
  }
)

exports.submitGuess = onCall(
  { enforceAppCheck: false, region },
  async (request) => {
    const uid = request.auth?.uid
    if (!uid) {
      throw new HttpsError('unauthenticated', 'You are not logged in')
    }

    const { roomId, round, countryCode } = request.data
    if (!roomId || round === undefined || !countryCode) {
      throw new HttpsError('invalid-argument', 'roomId, round, and countryCode are required')
    }

    const database = db()
    const gameRef = database.ref(`games/${roomId}`)
    const snapshot = await gameRef.get()

    if (!snapshot.exists()) {
      throw new HttpsError('not-found', 'Game not found')
    }

    const game = snapshot.val()

    if (game.status !== 'playing') {
      throw new HttpsError('failed-precondition', 'Game is not in playing state')
    }

    if (round !== game.currentRound) {
      throw new HttpsError('failed-precondition', 'Not the current round')
    }

    // Check if already guessed
    const existingGuess = game.players?.[uid]?.guesses?.[round]
    if (existingGuess) {
      throw new HttpsError('already-exists', 'You already guessed this round')
    }

    const correctCountry = game.rounds[round].country
    const isCorrect = countryCode.toUpperCase() === correctCountry.toUpperCase()

    // Scoring: Correct = 1000 + timeBonus (500 * timeRemaining/roundTime). Wrong = 0.
    let score = 0
    if (isCorrect) {
      const elapsed = (Date.now() - game.roundStartedAt) / 1000
      const timeRemaining = Math.max(0, game.roundTime - elapsed)
      const timeBonus = Math.round(500 * (timeRemaining / game.roundTime))
      score = 1000 + timeBonus
    }

    const updates = {}
    updates[`players/${uid}/guesses/${round}`] = {
      countryCode: countryCode.toUpperCase(),
      timestamp: Date.now(),
      score,
      correct: isCorrect
    }
    updates[`players/${uid}/score`] = (game.players[uid]?.score || 0) + score

    await gameRef.update(updates)

    return { score, correct: isCorrect }
  }
)

exports.submitMiss = onCall(
  { enforceAppCheck: false, region },
  async (request) => {
    const uid = request.auth?.uid
    if (!uid) {
      throw new HttpsError('unauthenticated', 'You are not logged in')
    }

    const { roomId, round } = request.data
    if (!roomId || round === undefined) {
      throw new HttpsError('invalid-argument', 'roomId and round are required')
    }

    const database = db()
    const gameRef = database.ref(`games/${roomId}`)
    const snapshot = await gameRef.get()

    if (!snapshot.exists()) {
      throw new HttpsError('not-found', 'Game not found')
    }

    const game = snapshot.val()

    // Check if already guessed
    const existingGuess = game.players?.[uid]?.guesses?.[round]
    if (existingGuess) {
      return { score: 0, correct: false }
    }

    const updates = {}
    updates[`players/${uid}/guesses/${round}`] = {
      countryCode: 'MISS',
      timestamp: Date.now(),
      score: 0,
      correct: false
    }

    await gameRef.update(updates)

    return { score: 0, correct: false }
  }
)

exports.nextRound = onCall(
  { enforceAppCheck: false, region },
  async (request) => {
    const uid = request.auth?.uid
    if (!uid) {
      throw new HttpsError('unauthenticated', 'You are not logged in')
    }

    const { roomId } = request.data
    if (!roomId) {
      throw new HttpsError('invalid-argument', 'roomId is required')
    }

    const database = db()
    const gameRef = database.ref(`games/${roomId}`)
    const snapshot = await gameRef.get()

    if (!snapshot.exists()) {
      throw new HttpsError('not-found', 'Game not found')
    }

    const game = snapshot.val()

    if (game.hostId !== uid) {
      throw new HttpsError('permission-denied', 'Only the host can advance rounds')
    }

    const currentRound = game.currentRound

    // Reveal current round answer
    await gameRef.child(`rounds/${currentRound}/revealed`).set(true)

    const nextRound = currentRound + 1

    if (nextRound >= game.totalRounds) {
      // Game finished
      await gameRef.update({
        status: 'finished',
        finishedAt: Date.now()
      })
      return { status: 'finished', round: currentRound }
    }

    // Advance to next round
    await gameRef.update({
      currentRound: nextRound,
      status: 'playing',
      roundStartedAt: Date.now()
    })

    return { status: 'playing', round: nextRound }
  }
)

exports.transferHost = onCall(
  { enforceAppCheck: false, region },
  async (request) => {
    const uid = request.auth?.uid
    if (!uid) throw new HttpsError('unauthenticated', 'You are not logged in')

    const { roomId, targetUid } = request.data
    if (!roomId || !targetUid) throw new HttpsError('invalid-argument', 'roomId and targetUid are required')

    const database = db()
    const gameRef = database.ref(`games/${roomId}`)
    const snapshot = await gameRef.get()
    if (!snapshot.exists()) throw new HttpsError('not-found', 'Game not found')

    const game = snapshot.val()
    if (game.hostId !== uid) throw new HttpsError('permission-denied', 'Only the host can transfer host role')
    if (!game.players?.[targetUid]) throw new HttpsError('not-found', 'Target player not in game')

    await gameRef.update({ hostId: targetUid })
    return { success: true, newHostId: targetUid }
  }
)

exports.startGame = onCall(
  { enforceAppCheck: false, region },
  async (request) => {
    const uid = request.auth?.uid
    if (!uid) {
      throw new HttpsError('unauthenticated', 'You are not logged in')
    }

    const { roomId } = request.data
    if (!roomId) {
      throw new HttpsError('invalid-argument', 'roomId is required')
    }

    const database = db()
    const gameRef = database.ref(`games/${roomId}`)
    const snapshot = await gameRef.get()

    if (!snapshot.exists()) {
      throw new HttpsError('not-found', 'Game not found')
    }

    const game = snapshot.val()

    if (game.hostId !== uid) {
      throw new HttpsError('permission-denied', 'Only the host can start the game')
    }

    await gameRef.update({
      status: 'playing',
      roundStartedAt: Date.now()
    })

    return { status: 'playing', round: 0 }
  }
)

// ── Location pool ─────────────────────────────────────────────────

/**
 * Pick N random locations from the AI-generated pool.
 * Falls back to static locations if pool is empty or too small.
 */
async function pickLocationsFromPool (database, count) {
  try {
    const snapshot = await database.ref('location-pool').once('value')
    const pool = snapshot.val()

    if (pool) {
      const entries = Object.values(pool)
      if (entries.length >= count) {
        return shuffleArray([...entries]).slice(0, count)
      }
    }
  } catch (err) {
    console.warn('Failed to read location pool:', err.message)
  }

  // Fallback to static locations
  return shuffleArray([...locations]).slice(0, count)
}

/**
 * Scheduled function: calls Gemini to generate locations and
 * adds them to the location-pool in Realtime Database.
 * Runs daily. Keeps pool capped at ~500 entries.
 */
exports.generateLocationPool = onSchedule(
  {
    schedule: 'every 24 hours',
    timeZone: 'UTC',
    region,
    secrets: [googleMapsApiKey]
  },
  async () => {
    const database = db()
    const poolRef = database.ref('location-pool')

    // Check current pool size
    const snapshot = await poolRef.once('value')
    const currentSize = snapshot.numChildren()
    const maxPoolSize = 500

    if (currentSize >= maxPoolSize) {
      console.log(`Location pool already has ${currentSize} entries (max ${maxPoolSize}), skipping generation`)
      return null
    }

    const batchSize = Math.min(50, maxPoolSize - currentSize)
    console.log(`Generating ${batchSize} new locations via Gemini (pool: ${currentSize}/${maxPoolSize})`)

    const newLocations = await generateLocations(batchSize)

    // Deduplicate against existing pool
    const existing = snapshot.val() || {}
    const existingCoords = new Set(
      Object.values(existing).map(l => `${l.lat.toFixed(2)},${l.lng.toFixed(2)}`)
    )

    let added = 0
    for (const loc of newLocations) {
      const key = `${loc.lat.toFixed(2)},${loc.lng.toFixed(2)}`
      if (!existingCoords.has(key)) {
        await poolRef.push({
          lat: loc.lat,
          lng: loc.lng,
          country: loc.country,
          addedAt: Date.now()
        })
        existingCoords.add(key)
        added++
      }
    }

    console.log(`Added ${added} new locations to pool (total: ${currentSize + added})`)
    return null
  }
)

/**
 * Manual trigger to populate the location pool on demand.
 * Host-only — requires auth. Call from admin tooling or CLI.
 */
exports.seedLocationPool = onCall(
  { enforceAppCheck: false, region, secrets: [googleMapsApiKey] },
  async (request) => {
    const uid = request.auth?.uid
    if (!uid) throw new HttpsError('unauthenticated', 'You are not logged in')

    const count = request.data?.count || 50

    const database = db()
    const poolRef = database.ref('location-pool')
    const snapshot = await poolRef.once('value')
    const currentSize = snapshot.numChildren()

    const newLocations = await generateLocations(count)

    const existing = snapshot.val() || {}
    const existingCoords = new Set(
      Object.values(existing).map(l => `${l.lat.toFixed(2)},${l.lng.toFixed(2)}`)
    )

    let added = 0
    for (const loc of newLocations) {
      const key = `${loc.lat.toFixed(2)},${loc.lng.toFixed(2)}`
      if (!existingCoords.has(key)) {
        await poolRef.push({
          lat: loc.lat,
          lng: loc.lng,
          country: loc.country,
          addedAt: Date.now()
        })
        existingCoords.add(key)
        added++
      }
    }

    return { added, totalPool: currentSize + added }
  }
)

exports.cleanup = onSchedule(
  {
    schedule: 'every 24 hours',
    timeZone: 'UTC',
    region
  },
  async () => {
    const database = db()
    const snapshot = await database.ref('games').get()
    const data = snapshot.val()

    if (!data) {
      console.log('No games to clean up')
      return null
    }

    const cutoff = Date.now() - (24 * 60 * 60 * 1000)
    let removed = 0

    for (const [roomId, game] of Object.entries(data)) {
      if (game.createdAt && game.createdAt < cutoff) {
        await database.ref(`games/${roomId}`).remove()
        removed++
      }
    }

    console.log(`Cleanup: removed ${removed} expired games`)
    return null
  }
)
