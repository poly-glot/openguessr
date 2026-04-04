import { LitElement, html, css } from 'lit'
import { buttonStyles } from '../shared-styles'

export class GameLeaderboard extends LitElement {
  static properties = {
    players: { type: Object },
    hostId: { type: String, attribute: 'host-id' },
    currentUid: { type: String, attribute: 'current-uid' },
    isHost: { type: Boolean, attribute: 'is-host' },
    roomId: { type: String, attribute: 'room-id' }
  }

  static styles = [buttonStyles, css`
    :host { display: block; }

    .leaderboard { padding: 20px; }

    .leaderboard__title {
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: #888;
      font-weight: 600;
      margin-bottom: 16px;
    }

    .leaderboard__entry {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 6px;
      border-bottom: 1px solid var(--borderColor, rgb(0 0 0 / 15%));
      transition: background-color 0.15s;
    }

    .leaderboard__entry:hover { background-color: #f0f0ee; }
    .leaderboard__entry:first-child { border-top: 1px solid var(--borderColor, rgb(0 0 0 / 15%)); }

    .leaderboard__rank {
      font-size: 0.75rem;
      color: #aaa;
      font-weight: 700;
      min-width: 18px;
      text-align: right;
      flex-shrink: 0;
    }

    .leaderboard__name {
      font-size: 0.85rem;
      font-weight: 500;
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .leaderboard__name--host::after {
      content: ' (host)';
      font-size: 0.68rem;
      color: #888;
      font-weight: normal;
    }

    .leaderboard__score {
      font-size: 0.75rem;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
      background: #f0f0f0;
      border: 1px solid var(--borderColor, rgb(0 0 0 / 15%));
      border-radius: 20px;
      padding: 3px 10px;
      flex-shrink: 0;
      white-space: nowrap;
    }

    .leaderboard__entry--self { background: #f5f5f0; border-radius: 4px; }

    .leaderboard__entry--self .leaderboard__score {
      background: var(--brand, #111);
      color: var(--brand-text, #fff);
      border-color: var(--brand, #111);
    }

    .leaderboard__request-host {
      font-size: 0.72rem;
      min-width: auto;
      min-height: 44px;
      padding: 10px 16px;
      margin-top: 16px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      width: 100%;
      background: transparent;
      border: 1px solid var(--brand, #111);
      color: var(--brand, #111);
    }

    .leaderboard__request-host:hover:not([disabled]),
    .leaderboard__request-host:focus:not([disabled]) {
      background: var(--brand, #111);
      color: var(--brand-text, #fff);
    }
  `]

  constructor () {
    super()
    this.players = {}
    this.hostId = null
    this.currentUid = null
    this.isHost = false
    this.roomId = null
  }

  _getEntries () {
    const entries = Object.entries(this.players || {})
      .map(([uid, data]) => ({
        uid,
        name: data.name || uid,
        score: data.score || 0,
        isHost: uid === this.hostId
      }))
      .sort((a, b) => {
        if (a.isHost !== b.isHost) return a.isHost ? -1 : 1
        return b.score - a.score || a.name.localeCompare(b.name)
      })

    const nameCounts = {}
    for (const entry of entries) {
      nameCounts[entry.name] = (nameCounts[entry.name] || 0) + 1
    }
    const nameIndex = {}
    for (const entry of entries) {
      if (nameCounts[entry.name] > 1) {
        nameIndex[entry.name] = (nameIndex[entry.name] || 0) + 1
        entry.displayName = `${entry.name} (${nameIndex[entry.name]})`
      } else {
        entry.displayName = entry.name
      }
    }
    return entries
  }

  _requestHost () {
    this.dispatchEvent(new CustomEvent('request-host', {
      bubbles: true,
      composed: true
    }))
  }

  render () {
    const entries = this._getEntries()

    return html`
      <div class="leaderboard" id="js-leaderboard">
        <h3 class="leaderboard__title">Leaderboard</h3>
        <div class="leaderboard__list" id="js-leaderboard-list">
          ${entries.map((entry, index) => html`
            <div
              class="leaderboard__entry ${entry.uid === this.currentUid ? 'leaderboard__entry--self' : ''}"
              data-cy="leaderboard-entry"
            >
              <span class="leaderboard__rank">${index + 1}.</span>
              <span class="leaderboard__name ${entry.isHost ? 'leaderboard__name--host' : ''}">${entry.displayName}</span>
              <span class="leaderboard__score" data-cy="player-score">${entry.score}</span>
            </div>
          `)}
        </div>
        ${!this.isHost && entries.length > 1 ? html`
          <button
            type="button"
            class="leaderboard__request-host"
            data-cy="request-host"
            @click=${this._requestHost}
          >Request Host Access</button>
        ` : ''}
      </div>
    `
  }
}

customElements.define('game-leaderboard', GameLeaderboard)
