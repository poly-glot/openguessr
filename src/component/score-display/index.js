import { LitElement, html, css } from 'lit'
import { getCountryByCode } from '../../data/countries'

const MOTIVATIONS_CORRECT = [
  'Amazing geography skills!',
  'You really know your world!',
  'Spot on! Keep it up!',
  'Nailed it!',
  'World traveler detected!'
]

const MOTIVATIONS_WRONG = [
  'Better luck next round!',
  'So close! Keep guessing!',
  'The world is full of surprises!',
  "Don't give up!",
  "Next one's yours!"
]

function randomMotivation (correct) {
  const list = correct ? MOTIVATIONS_CORRECT : MOTIVATIONS_WRONG
  return list[Math.floor(Math.random() * list.length)]
}

export class ScoreDisplay extends LitElement {
  static properties = {
    correct: { type: Boolean },
    score: { type: Number },
    correctCountryCode: { type: String, attribute: 'correct-country' },
    visible: { type: Boolean, reflect: true },
    waitingForHost: { type: Boolean, attribute: 'waiting-for-host' },
    _motivation: { state: true },
    _shaking: { state: true }
  }

  static styles = css`
    :host { display: contents; }
    :host(:not([visible])) .score-display { display: none; }

    .score-display {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      box-sizing: border-box;
      padding: 20px 24px;
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(8px);
      border-bottom: 2px solid var(--borderColor, rgb(0 0 0 / 15%));
      animation: scoreSlideDown 0.35s ease-out;
      z-index: 10;
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .score-display--shaking {
      animation: wrongShake 0.5s ease-out, scoreSlideDown 0.35s ease-out;
    }

    @keyframes scoreSlideDown {
      from { opacity: 0; transform: translateY(-100%); }
      to { opacity: 1; transform: translateY(0); }
    }

    .score-display__result {
      font-size: 1.3rem;
      font-weight: 700;
      white-space: nowrap;
    }

    .score-display__result--correct { color: var(--color-correct, #16a34a); }
    .score-display__result--wrong { color: var(--color-error, #ac1b11); }

    .score-display__points {
      font-size: 1rem;
      font-weight: 600;
      white-space: nowrap;
    }

    .score-display__answer {
      font-size: 0.82rem;
      color: #666;
      white-space: nowrap;
    }

    .score-display__motivation {
      font-size: 0.78rem;
      color: #999;
      font-style: italic;
      flex: 1;
    }

    .score-display__scoring-info {
      font-size: 0.7rem;
      color: #aaa;
      white-space: nowrap;
      cursor: help;
    }

    .score-display__close {
      appearance: none;
      background: transparent;
      border: 1px solid var(--borderColor, rgb(0 0 0 / 15%));
      border-radius: 4px;
      cursor: pointer;
      font-size: 1rem;
      color: #666;
      min-width: 32px;
      width: 32px;
      height: 32px;
      padding: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      transition: background 0.15s;
    }

    .score-display__close:hover { background: #eee; color: #222; }

    .score-display__waiting {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.78rem;
      color: #888;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    @keyframes wrongShake {
      0%, 100% { transform: translateX(0); }
      15% { transform: translateX(-6px); }
      30% { transform: translateX(6px); }
      45% { transform: translateX(-4px); }
      60% { transform: translateX(4px); }
      75% { transform: translateX(-2px); }
      90% { transform: translateX(2px); }
    }
  `

  constructor () {
    super()
    this.correct = false
    this.score = 0
    this.correctCountryCode = null
    this.visible = false
    this.waitingForHost = false
    this._motivation = ''
    this._shaking = false
  }

  updated (changed) {
    if (changed.has('visible') && this.visible) {
      this._motivation = randomMotivation(this.correct)
      this._shaking = !this.correct
    }
  }

  _close () {
    this.visible = false
    this.dispatchEvent(new CustomEvent('score-closed', { bubbles: true, composed: true }))
  }

  render () {
    const country = this.correctCountryCode ? getCountryByCode(this.correctCountryCode) : null
    const answerText = country ? `The answer was ${country.name}` : ''

    return html`
      <div
        class="score-display ${this._shaking ? 'score-display--shaking' : ''}"
        id="js-score-display"
        data-cy="score-display"
        role="alert"
      >
        <div class="score-display__result ${this.correct ? 'score-display__result--correct' : 'score-display__result--wrong'}">
          ${this.correct ? 'Correct!' : 'Wrong!'}
        </div>
        <div class="score-display__points">+${this.score} points
          <span class="score-display__scoring-info" title="1000 points for correct answer + up to 500 bonus for speed">&#9432;</span>
        </div>
        <div class="score-display__answer">${answerText}</div>
        <div class="score-display__motivation">${this._motivation}</div>
        <button
          class="score-display__close"
          aria-label="Close"
          @click=${this._close}
        >&times;</button>
        ${this.waitingForHost ? html`
          <div class="score-display__waiting" data-cy="waiting-for-host">
            <img src="/assets/loading.gif" alt="Waiting" width="20" height="20" />
            Waiting for host to start next round...
          </div>
        ` : ''}
      </div>
    `
  }
}

customElements.define('score-display', ScoreDisplay)
