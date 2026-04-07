import './index.css'

export function initLanding () {
  const landing = document.getElementById('landing-page')
  const app = document.getElementById('app-view')

  if (!landing || !app) return

  const params = new URLSearchParams(window.location.search)

  if (params.has('roomId')) {
    landing.hidden = true
    app.hidden = false
  } else {
    landing.hidden = false
    app.hidden = true
  }

  // Guard against duplicate listener attachment on re-init
  if (landing.dataset.listenersAttached) return
  landing.dataset.listenersAttached = 'true'

  document.querySelectorAll('[data-action="start-game"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault()
      landing.hidden = true
      app.hidden = false
      document.dispatchEvent(new CustomEvent('landing:start-game'))
    })
  })

  const brand = document.querySelector('.site__brand a')
  if (brand) {
    brand.addEventListener('click', (e) => {
      e.preventDefault()
      showLanding()
    })
  }
}

export function showLanding () {
  const landing = document.getElementById('landing-page')
  const app = document.getElementById('app-view')

  if (!landing || !app) return

  const url = new URL(window.location.href)
  if (url.searchParams.has('roomId')) {
    url.searchParams.delete('roomId')
    window.history.replaceState(null, '', url.toString())
  }

  landing.hidden = false
  app.hidden = true
}

export function isLandingVisible () {
  const landing = document.getElementById('landing-page')
  return landing && !landing.hidden
}
