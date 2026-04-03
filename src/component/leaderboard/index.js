import database from '../database'
import AlertService from '../../component/alert/alert'

export class Leaderboard {
  constructor () {
    this.isHost = false
    this.roomId = null
    this._currentUid = null
  }

  update (players, hostId) {
    const list = document.getElementById('js-leaderboard-list')
    if (!list) return

    const entries = Object.entries(players)
      .map(([uid, data]) => ({
        uid,
        name: data.name || uid,
        score: data.score || 0,
        isHost: uid === hostId
      }))
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))

    list.innerHTML = ''

    for (const [index, entry] of entries.entries()) {
      const div = document.createElement('div')
      div.className = 'leaderboard__entry' + (entry.uid === this._currentUid ? ' leaderboard__entry--self' : '')
      div.setAttribute('data-cy', 'leaderboard-entry')

      const rank = document.createElement('span')
      rank.className = 'leaderboard__rank'
      rank.textContent = `${index + 1}.`

      const name = document.createElement('span')
      name.className = 'leaderboard__name' + (entry.isHost ? ' leaderboard__name--host' : '')
      name.textContent = entry.name

      const score = document.createElement('span')
      score.className = 'leaderboard__score'
      score.setAttribute('data-cy', 'player-score')
      score.textContent = entry.score

      div.appendChild(rank)
      div.appendChild(name)

      if (this.isHost && entry.uid !== this._currentUid) {
        const btn = document.createElement('button')
        btn.type = 'button'
        btn.className = 'leaderboard__make-host'
        btn.textContent = 'Make Host'
        btn.setAttribute('data-cy', 'make-host')
        btn.addEventListener('click', async () => {
          btn.disabled = true
          try {
            await database.transferHost(this.roomId, entry.uid)
          } catch (err) {
            AlertService.announce('Failed to transfer host: ' + err.message)
            btn.disabled = false
          }
        })
        div.appendChild(btn)
      }

      div.appendChild(score)
      list.appendChild(div)
    }
  }
}
