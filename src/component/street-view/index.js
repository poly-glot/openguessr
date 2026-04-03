import { createStreetViewUrl } from '../../data/maps'

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''

export class StreetView {
  load (lat, lng) {
    const container = document.getElementById('js-street-view')
    if (!container) return

    const url = createStreetViewUrl(lat, lng, GOOGLE_MAPS_API_KEY)
    container.innerHTML = `<iframe src="${url}" allowfullscreen loading="lazy" data-cy="street-view-iframe"></iframe>`
  }

  showLobby (playerCount, playerNamesHtml) {
    const container = document.getElementById('js-street-view')
    if (!container) return

    container.innerHTML = `
      <div class="street-view__placeholder">
        <img src="/assets/loading.gif" alt="Waiting" width="40" height="40" />
        <p>Waiting for host to start the game...</p>
        <div class="lobby-info" data-cy="lobby-info">
          <div class="lobby-info__count">${playerCount} player${playerCount !== 1 ? 's' : ''} in lobby</div>
          <div class="lobby-info__names">${playerNamesHtml}</div>
        </div>
      </div>
    `
  }

  showGameOver (html) {
    const container = document.getElementById('js-street-view')
    if (!container) return
    container.innerHTML = html
  }
}
