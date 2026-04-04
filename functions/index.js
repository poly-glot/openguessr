const { onCall, HttpsError } = require('firebase-functions/v2/https')
const { onSchedule } = require('firebase-functions/v2/scheduler')
const { defineSecret } = require('firebase-functions/params')
const { initializeApp } = require('firebase-admin/app')

const googleMapsApiKey = defineSecret('openguessr-GOOGLE_MAPS_API_KEY')
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

const region = 'europe-west2'
const TOTAL_ROUNDS = 5
const ROUND_TIME = 30

function haversineKm (lat1, lng1, lat2, lng2) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function distanceScore (distanceKm) {
  if (distanceKm <= 0) return 5000
  return Math.round(5000 * Math.exp(-distanceKm / 2000))
}

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
    const answers = {}
    for (let i = 0; i < TOTAL_ROUNDS; i++) {
      rounds[i] = {
        lat: selected[i].lat,
        lng: selected[i].lng,
        revealed: false
      }
      answers[i] = selected[i].country
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
    await database.ref(`game-answers/${roomId}`).set(answers)

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

    const { roomId, round, lat, lng } = request.data
    if (!roomId || round === undefined || typeof lat !== 'number' || typeof lng !== 'number') {
      throw new HttpsError('invalid-argument', 'roomId, round, lat, and lng are required')
    }

    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      throw new HttpsError('invalid-argument', 'lat must be [-90,90] and lng must be [-180,180]')
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

    const roundData = game.rounds?.[round]
    if (!roundData || roundData.lat == null || roundData.lng == null) {
      throw new HttpsError('not-found', 'Round location not found')
    }

    const distanceKm = haversineKm(lat, lng, roundData.lat, roundData.lng)
    const score = distanceScore(distanceKm)

    await gameRef.child(`players/${uid}/guesses/${round}`).set({
      lat,
      lng,
      distanceKm: Math.round(distanceKm * 10) / 10,
      score,
      timestamp: Date.now()
    })

    // Use transaction for atomic score update to prevent race conditions
    const scoreRef = gameRef.child(`players/${uid}/score`)
    await scoreRef.transaction((currentScore) => (currentScore || 0) + score)

    return {
      score,
      distanceKm: Math.round(distanceKm * 10) / 10,
      answerLat: roundData.lat,
      answerLng: roundData.lng
    }
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

    if (game.status !== 'playing') {
      throw new HttpsError('failed-precondition', 'Game is not in playing state')
    }

    if (round !== game.currentRound) {
      throw new HttpsError('failed-precondition', 'Not the current round')
    }

    // Check if already guessed
    const existingGuess = game.players?.[uid]?.guesses?.[round]
    if (existingGuess) {
      return { score: 0, distanceKm: null }
    }

    const updates = {}
    updates[`players/${uid}/guesses/${round}`] = {
      lat: null,
      lng: null,
      distanceKm: null,
      score: 0,
      timestamp: Date.now()
    }

    await gameRef.update(updates)

    return { score: 0, distanceKm: null }
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

    // Reveal current round answer — copy country from answers to the round
    const answerSnapshot = await database.ref(`game-answers/${roomId}/${currentRound}`).get()
    const country = answerSnapshot.val()
    await gameRef.child(`rounds/${currentRound}`).update({
      revealed: true,
      country: country || null
    })

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
 * Deduplicate and push new locations into the pool.
 * Returns the number of locations actually added.
 */
async function addLocationsToPool (poolRef, existingSnapshot, newLocations) {
  const existing = existingSnapshot.val() || {}
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
  return added
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
    const added = await addLocationsToPool(poolRef, snapshot, newLocations)

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

    const maxPoolSize = 500
    const database = db()
    const poolRef = database.ref('location-pool')
    const snapshot = await poolRef.once('value')
    const currentSize = snapshot.numChildren()

    if (currentSize >= maxPoolSize) {
      return { added: 0, totalPool: currentSize }
    }

    const count = Math.min(request.data?.count || 50, maxPoolSize - currentSize)
    const newLocations = await generateLocations(count)
    const added = await addLocationsToPool(poolRef, snapshot, newLocations)

    return { added, totalPool: currentSize + added }
  }
)

// ── Host Promotion ───────────────────────────────────────────────

const PROMOTION_TIMEOUT_MS = 60000

exports.requestHostPromotion = onCall(
  { enforceAppCheck: false, region },
  async (request) => {
    const uid = request.auth?.uid
    if (!uid) throw new HttpsError('unauthenticated', 'You are not logged in')

    const { roomId } = request.data
    if (!roomId) throw new HttpsError('invalid-argument', 'roomId is required')

    const database = db()
    const gameRef = database.ref(`games/${roomId}`)
    const gameSnapshot = await gameRef.get()

    if (!gameSnapshot.exists()) throw new HttpsError('not-found', 'Game not found')

    const game = gameSnapshot.val()

    if (game.hostId === uid) {
      throw new HttpsError('failed-precondition', 'You are already the host of this game')
    }

    if (!game.players?.[uid]) {
      throw new HttpsError('permission-denied', 'You are not a player in this game')
    }

    // Check no pending request exists
    const requestRef = database.ref(`promotionRequests/${roomId}`)
    const existing = await requestRef.get()
    if (existing.exists()) {
      const data = existing.val()
      if (data.status === 'pending' && Date.now() < data.expiresAt) {
        throw new HttpsError('failed-precondition', 'A promotion request is already in progress')
      }
    }

    const members = Object.keys(game.players)
    const playerName = game.players[uid]?.name || uid
    const now = Date.now()

    const requestData = {
      requesterId: uid,
      requesterName: playerName,
      status: 'pending',
      createdAt: now,
      expiresAt: now + PROMOTION_TIMEOUT_MS,
      memberCount: members.length,
      roomId,
      votes: {
        [uid]: { vote: true, name: playerName }
      }
    }

    await requestRef.set(requestData)

    // If requester is the only player, resolve immediately
    if (members.length <= 1) {
      const resolution = await resolveHostPromotionRequest(database, roomId, requestData)
      return {
        success: true,
        expiresAt: requestData.expiresAt,
        resolved: true,
        result: resolution.result,
        requestData: { ...requestData, status: resolution.result }
      }
    }

    return { success: true, expiresAt: requestData.expiresAt }
  }
)

exports.voteOnHostPromotion = onCall(
  { enforceAppCheck: false, region },
  async (request) => {
    const uid = request.auth?.uid
    if (!uid) throw new HttpsError('unauthenticated', 'You are not logged in')

    const { roomId, vote } = request.data
    if (!roomId || typeof vote !== 'boolean') {
      throw new HttpsError('invalid-argument', 'roomId and vote (boolean) are required')
    }

    const database = db()
    const requestRef = database.ref(`promotionRequests/${roomId}`)
    const snapshot = await requestRef.get()

    if (!snapshot.exists()) throw new HttpsError('not-found', 'No promotion request found')

    const data = snapshot.val()

    if (data.status !== 'pending') {
      throw new HttpsError('failed-precondition', 'This promotion request has already been resolved')
    }

    if (Date.now() > data.expiresAt) {
      throw new HttpsError('deadline-exceeded', 'Voting period has expired')
    }

    if (data.votes && data.votes[uid]) {
      throw new HttpsError('already-exists', 'You have already voted')
    }

    // Get voter name from the game
    const gameSnapshot = await database.ref(`games/${roomId}/players/${uid}/name`).get()
    const voterName = gameSnapshot.val() || uid

    await requestRef.child(`votes/${uid}`).set({ vote, name: voterName })

    // Check if all members have voted for early resolution
    const updatedSnapshot = await requestRef.get()
    const updatedData = updatedSnapshot.val()
    const voteCount = Object.keys(updatedData.votes || {}).length

    if (voteCount >= updatedData.memberCount) {
      return resolveHostPromotionRequest(database, roomId, updatedData)
    }

    return { success: true, resolved: false }
  }
)

exports.resolveHostPromotion = onCall(
  { enforceAppCheck: false, region },
  async (request) => {
    const uid = request.auth?.uid
    if (!uid) throw new HttpsError('unauthenticated', 'You are not logged in')

    const { roomId } = request.data
    if (!roomId) throw new HttpsError('invalid-argument', 'roomId is required')

    const database = db()
    const requestRef = database.ref(`promotionRequests/${roomId}`)
    const snapshot = await requestRef.get()

    if (!snapshot.exists()) throw new HttpsError('not-found', 'No promotion request found')

    const data = snapshot.val()

    if (data.status !== 'pending') {
      throw new HttpsError('failed-precondition', 'This promotion request has already been resolved')
    }

    if (Date.now() < data.expiresAt) {
      throw new HttpsError('failed-precondition', 'Voting period has not expired yet')
    }

    return resolveHostPromotionRequest(database, roomId, data)
  }
)

/**
 * Calculate vote result and transfer host if approved.
 * Non-voters count as implicit approvals.
 */
async function resolveHostPromotionRequest (database, roomId, data) {
  const votes = data.votes || {}
  const voteEntries = Object.values(votes)
  const explicitApprovals = voteEntries.filter(v => v.vote === true).length
  const explicitRejections = voteEntries.filter(v => v.vote === false).length
  const nonVoters = data.memberCount - voteEntries.length

  const totalApprovals = explicitApprovals + nonVoters
  const approved = totalApprovals >= explicitRejections

  const result = approved ? 'approved' : 'denied'

  const requestRef = database.ref(`promotionRequests/${roomId}`)
  await requestRef.update({ status: result })

  if (approved) {
    await database.ref(`games/${roomId}/hostId`).set(data.requesterId)
  }

  return { success: true, resolved: true, result }
}

exports.cleanup = onSchedule(
  {
    schedule: 'every 24 hours',
    timeZone: 'UTC',
    region
  },
  async () => {
    const database = db()
    const cutoff = Date.now() - (24 * 60 * 60 * 1000)

    const snapshot = await database.ref('games')
      .orderByChild('createdAt')
      .endAt(cutoff)
      .get()

    const data = snapshot.val()

    if (!data) {
      console.log('No games to clean up')
      return null
    }

    let removed = 0

    for (const roomId of Object.keys(data)) {
      await database.ref(`games/${roomId}`).remove()
      removed++
    }

    console.log(`Cleanup: removed ${removed} expired games`)
    return null
  }
)
