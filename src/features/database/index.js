import { getApp } from 'firebase/app'
import { getDatabase, ref, onValue, off, onDisconnect, set, serverTimestamp } from 'firebase/database'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { getAuth, onAuthStateChanged, signInWithCustomToken, updateProfile, signOut as firebaseSignOut } from 'firebase/auth'

import authDialog from '../auth-dialog'
import gameScreen from '../game-screen'

const FUNCTIONS_REGION = 'europe-west2'

function callFunction (name, data) {
  const functions = getFunctions(getApp(), FUNCTIONS_REGION)
  const fn = httpsCallable(functions, name)
  return fn(data).then(r => r.data)
}

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

    const auth = getAuth()
    const { token } = await callFunction('login', { username })
    await signInWithCustomToken(auth, token)
    await updateProfile(auth.currentUser, { displayName: username })
  }

  async signOut () {
    this.cleanup()
    const auth = getAuth()
    await firebaseSignOut(auth)
  }

  async createGame (username) {
    const auth = getAuth()
    const { roomId, token } = await callFunction('createGame', { username })
    await signInWithCustomToken(auth, token)
    await updateProfile(auth.currentUser, { displayName: username })

    return roomId
  }

  async joinGame (roomId, username) {
    return callFunction('joinGame', { roomId, username })
  }

  async submitGuess (roomId, round, lat, lng) {
    return callFunction('submitGuess', { roomId, round, lat, lng })
  }

  async submitMiss (roomId, round) {
    return callFunction('submitMiss', { roomId, round })
  }

  async nextRound (roomId) {
    return callFunction('nextRound', { roomId })
  }

  async startGame (roomId) {
    return callFunction('startGame', { roomId })
  }

  async transferHost (roomId, targetUid) {
    return callFunction('transferHost', { roomId, targetUid })
  }

  async requestHostPromotion (roomId) {
    return callFunction('requestHostPromotion', { roomId })
  }

  async voteOnHostPromotion (roomId, vote) {
    return callFunction('voteOnHostPromotion', { roomId, vote })
  }

  async resolveHostPromotion (roomId) {
    return callFunction('resolveHostPromotion', { roomId })
  }

  listenPromotionRequests (roomId, callback) {
    const db = getDatabase()
    const promotionRef = ref(db, `promotionRequests/${roomId}`)
    onValue(promotionRef, (snapshot) => {
      callback(snapshot.val())
    })
    this._listeners.push(promotionRef)
  }

  setupPresence (roomId, uid) {
    const db = getDatabase()
    const presenceRef = ref(db, `games/${roomId}/players/${uid}/online`)
    const lastSeenRef = ref(db, `games/${roomId}/players/${uid}/lastSeen`)
    set(presenceRef, true)
    onDisconnect(presenceRef).set(false)
    onDisconnect(lastSeenRef).set(serverTimestamp())
    this._listeners.push(presenceRef)
    this._listeners.push(lastSeenRef)
  }

  listenConnection (onConnected, onDisconnected) {
    const db = getDatabase()
    const connRef = ref(db, '.info/connected')
    onValue(connRef, (snapshot) => {
      if (snapshot.val() === true) {
        onConnected()
      } else {
        onDisconnected()
      }
    })
    this._listeners.push(connRef)
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
