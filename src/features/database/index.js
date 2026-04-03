import { getApp } from 'firebase/app'
import { getDatabase, ref, onValue, off } from 'firebase/database'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { getAuth, onAuthStateChanged, signInWithCustomToken, updateProfile, signOut as firebaseSignOut } from 'firebase/auth'

import authDialog from '../auth-dialog'
import gameScreen from '../game-screen'

const FUNCTIONS_REGION = 'us-central1'

export class GameDatabase {
  constructor () {
    this.gameRef = null
    this.playersRef = null
    this._listeners = []
    this._username = null
  }

  async init () {
    this.onUserStateChange()
  }

  onUserStateChange () {
    const auth = getAuth()
    onAuthStateChanged(auth, async (user) => {
      authDialog.toggleVisibilityBasedOnAuth(user)
      if (user) {
        await gameScreen.resumeJourney(user)
      }
    })
  }

  async signIn (username) {
    this._username = username

    const functions = getFunctions(getApp(), FUNCTIONS_REGION)
    const loginFunction = httpsCallable(functions, 'login')

    const auth = getAuth()
    const { data: { token } } = await loginFunction({ username })
    await signInWithCustomToken(auth, token)
    await updateProfile(auth.currentUser, { displayName: username })
  }

  async signOut () {
    this.cleanup()
    const auth = getAuth()
    await firebaseSignOut(auth)
  }

  async createGame (username) {
    const functions = getFunctions(getApp(), FUNCTIONS_REGION)
    const createGameFn = httpsCallable(functions, 'createGame')

    const auth = getAuth()
    const { data: { roomId, token } } = await createGameFn({ username })
    await signInWithCustomToken(auth, token)
    await updateProfile(auth.currentUser, { displayName: username })

    return roomId
  }

  async joinGame (roomId, username) {
    const functions = getFunctions(getApp(), FUNCTIONS_REGION)
    const joinGameFn = httpsCallable(functions, 'joinGame')

    const { data } = await joinGameFn({ roomId, username })
    return data
  }

  async submitGuess (roomId, round, countryCode) {
    const functions = getFunctions(getApp(), FUNCTIONS_REGION)
    const submitGuessFn = httpsCallable(functions, 'submitGuess')

    const { data } = await submitGuessFn({ roomId, round, countryCode })
    return data
  }

  async submitMiss (roomId, round) {
    const functions = getFunctions(getApp(), FUNCTIONS_REGION)
    const submitMissFn = httpsCallable(functions, 'submitMiss')

    const { data } = await submitMissFn({ roomId, round })
    return data
  }

  async nextRound (roomId) {
    const functions = getFunctions(getApp(), FUNCTIONS_REGION)
    const nextRoundFn = httpsCallable(functions, 'nextRound')

    const { data } = await nextRoundFn({ roomId })
    return data
  }

  async startGame (roomId) {
    const functions = getFunctions(getApp(), FUNCTIONS_REGION)
    const startGameFn = httpsCallable(functions, 'startGame')

    const { data } = await startGameFn({ roomId })
    return data
  }

  async transferHost (roomId, targetUid) {
    const functions = getFunctions(getApp(), FUNCTIONS_REGION)
    const transferHostFn = httpsCallable(functions, 'transferHost')

    const { data } = await transferHostFn({ roomId, targetUid })
    return data
  }

  listenGameChanges (roomId, callback) {
    const db = getDatabase()
    this.gameRef = ref(db, `games/${roomId}`)
    onValue(this.gameRef, (snapshot) => {
      const data = snapshot.val()
      if (data) {
        callback(data)
      }
    })
    this._listeners.push(this.gameRef)
  }

  listenPlayers (roomId, callback) {
    const db = getDatabase()
    this.playersRef = ref(db, `games/${roomId}/players`)
    onValue(this.playersRef, (snapshot) => {
      const data = snapshot.val()
      if (data) {
        callback(data)
      }
    })
    this._listeners.push(this.playersRef)
  }

  cleanup () {
    this._listeners.forEach(r => off(r))
    this._listeners = []
    this.gameRef = null
    this.playersRef = null
  }
}

export default new GameDatabase()
