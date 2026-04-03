import { initializeApp } from 'firebase/app'
import { getAuth, connectAuthEmulator } from 'firebase/auth'
import { getDatabase, connectDatabaseEmulator } from 'firebase/database'
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions'

const isEmulatorMode = import.meta.env.VITE_USE_EMULATORS === 'true'

const productionConfig = {
  apiKey: 'AIzaSyAHt3QJRBDISRaWaqblQl2VwjWiHvjpgIs',
  projectId: 'openguessr-firebase',
  authDomain: 'openguessr-firebase.firebaseapp.com',
  databaseURL: 'https://openguessr-firebase-default-rtdb.firebaseio.com'
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
