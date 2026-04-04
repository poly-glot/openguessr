import './firebase-init'

import AlertService from './component/alert/alert'
import GameDatabase from './features/database'

import './component/core-css'
import './component/landing/index.css'

import { initLanding } from './component/landing'

async function main () {
  initLanding()

  AlertService.init()

  await GameDatabase.init()
  AlertService.announce('Ready to play!')
}

main()
