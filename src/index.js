import './firebase-init'

import AlertService from './component/alert/alert'
import GameDatabase from './features/database'

import './component/core-css'
import './component/dialog/index.css'
import './component/street-view/index.css'
import './component/country-picker/index.css'
import './component/timer/index.css'
import './component/score-display/index.css'
import './component/leaderboard/index.css'

import { initLanding } from './component/landing'

async function main () {
  initLanding()

  AlertService.init()

  await GameDatabase.init()
  AlertService.announce('Ready to play!')
}

main()
