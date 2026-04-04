import { LitElement, html, css } from 'lit'
import { buttonStyles } from '../shared-styles'

export class GameOver extends LitElement {
  static properties = {
    players: { type: Array },
    currentUid: { type: String, attribute: 'current-uid' },
    totalRounds: { type: Number, attribute: 'total-rounds' }
  }

  static styles = [buttonStyles, css`
    :host { display: block; }

    .game-over {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      position: absolute;
      inset: 0;
      color: #888;
      gap: 12px;
    }

    .game-over__title {
      font-size: 1.8rem;
      font-weight: 700;
      margin: 0;
      color: #222;
    }

    .game-over__winner {
      font-size: 1.2rem;
      font-weight: 600;
      color: var(--color-correct, #16a34a);
      animation: winnerReveal 0.6s ease-out;
    }

    @keyframes winnerReveal {
      from { opacity: 0; transform: scale(0.9); }
      to { opacity: 1; transform: scale(1); }
    }

    .game-over__final-scores {
      width: 100%;
      max-width: 400px;
    }

    .game-over__table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.85rem;
    }

    .game-over__table th {
      text-align: left;
      font-size: 0.7rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #888;
      border-bottom: 1px solid #ddd;
      padding: 6px 8px;
    }

    .game-over__table td {
      padding: 8px;
      border-bottom: 1px solid #eee;
      color: #222;
    }

    .game-over__row--self {
      background: #f5f5f0;
      font-weight: 600;
    }

    .game-over__actions { margin-top: 8px; }
  `]

  constructor () {
    super()
    this.players = []
    this.currentUid = null
    this.totalRounds = 5
  }

  render () {
    const winner = this.players[0]
    const isWinner = winner && winner.uid === this.currentUid
    const maxScore = this.totalRounds * 5000

    return html`
      <div class="game-over" data-cy="game-over">
        <h2 class="game-over__title">Game Over!</h2>
        ${winner ? html`
          <div class="game-over__winner" data-cy="winner">
            ${isWinner ? 'You win!' : `${winner.name} wins!`}
          </div>
        ` : ''}
        <div class="game-over__final-scores" data-cy="final-scores">
          <table class="game-over__table">
            <thead>
              <tr><th>Rank</th><th>Player</th><th>Score</th></tr>
            </thead>
            <tbody>
              ${this.players.map((entry, i) => html`
                <tr class=${entry.uid === this.currentUid ? 'game-over__row--self' : ''}>
                  <td>${i + 1}</td>
                  <td>${entry.name}${entry.isHost ? html` <small>(host)</small>` : ''}</td>
                  <td>${entry.score} / ${maxScore}</td>
                </tr>
              `)}
            </tbody>
          </table>
        </div>
        <div class="game-over__actions">
          <button type="button" data-cy="play-again" @click=${() => { window.location.href = '/' }}>Play Again</button>
        </div>
      </div>
    `
  }
}

customElements.define('game-over', GameOver)
