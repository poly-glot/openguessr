import { initializeApp } from 'firebase/app'
import { getAuth, connectAuthEmulator } from 'firebase/auth'
import { getDatabase, connectDatabaseEmulator } from 'firebase/database'
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions'

const isEmulatorMode = import.meta.env.VITE_USE_EMULATORS === 'true'

const productionConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  appId: '1:563789376070:web:9f2f30f0ff877901f07847',
  projectId: 'firebase-cloud-491613',
  authDomain: 'fir-cloud-491613.firebaseapp.com',
  databaseURL: 'https://firebase-cloud-491613-default-rtdb.europe-west1.firebasedatabase.app',
  storageBucket: 'firebase-cloud-491613.firebasestorage.app',
  messagingSenderId: '563789376070'
}

const emulatorConfig = {
  apiKey: 'demo-key',
  projectId: 'demo-openguessr',
  authDomain: 'localhost',
  databaseURL: 'http://localhost:9001?ns=demo-openguessr'
}

const firebaseConfig = isEmulatorMode ? emulatorConfig : productionConfig
const app = initializeApp(firebaseConfig)

if (isEmulatorMode) {
  const firebaseEmulators = {
    auth: { host: 'localhost', port: 9099 },
    database: { host: 'localhost', port: 9001 },
    functions: { host: 'localhost', port: 5001 }
  }

  const auth = getAuth()
  const db = getDatabase()
  const functions = getFunctions(app)

  connectAuthEmulator(auth, `http://${firebaseEmulators.auth.host}:${firebaseEmulators.auth.port}`)
  connectDatabaseEmulator(db, firebaseEmulators.database.host, firebaseEmulators.database.port)
  connectFunctionsEmulator(functions, firebaseEmulators.functions.host, firebaseEmulators.functions.port)
}
