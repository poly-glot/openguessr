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
  'Don\'t give up!',
  'Next one\'s yours!'
]

function randomMotivation (correct) {
  const list = correct ? MOTIVATIONS_CORRECT : MOTIVATIONS_WRONG
  return list[Math.floor(Math.random() * list.length)]
}

export class ScoreDisplay {
  constructor () {
    this._closeBound = false
  }

  show (correct, score, correctCountryCode) {
    const display = document.getElementById('js-score-display')
    const resultEl = document.getElementById('js-score-result')
    const pointsEl = document.getElementById('js-score-points')
    const answerEl = document.getElementById('js-score-answer')
    const motivationEl = document.getElementById('js-score-motivation')

    if (!display) return

    display.hidden = false

    resultEl.textContent = correct ? 'Correct!' : 'Wrong!'
    resultEl.className = 'score-display__result ' + (correct ? 'score-display__result--correct' : 'score-display__result--wrong')

    pointsEl.textContent = `+${score} points`

    if (correctCountryCode) {
      const country = getCountryByCode(correctCountryCode)
      answerEl.textContent = country ? `The answer was ${country.name}` : ''
    } else {
      answerEl.textContent = ''
    }

    if (motivationEl) {
      motivationEl.textContent = randomMotivation(correct)
    }

    if (!this._closeBound) {
      const closeBtn = document.getElementById('js-score-close')
      if (closeBtn) {
        this._closeBound = true
        closeBtn.addEventListener('click', () => this.hide())
      }
    }

    const wrap = document.getElementById('js-street-view-wrap')
    if (correct) {
      this._showConfetti(wrap)
    } else {
      this._showWrongEffect(wrap)
    }
  }

  hide () {
    const display = document.getElementById('js-score-display')
    if (display) {
      display.hidden = true
      display.style.animation = ''
      const waiting = display.querySelector('.score-display__waiting')
      if (waiting) waiting.remove()
    }
    const wrap = document.getElementById('js-street-view-wrap')
    if (wrap) {
      wrap.querySelectorAll('.confetti-canvas, .wrong-flash').forEach(el => el.remove())
    }
  }

  showWaitingForHost () {
    const display = document.getElementById('js-score-display')
    if (!display) return

    if (display.querySelector('.score-display__waiting')) return

    const div = document.createElement('div')
    div.className = 'score-display__waiting'
    div.setAttribute('data-cy', 'waiting-for-host')
    div.innerHTML = '<img src="/assets/loading.gif" alt="Waiting" width="20" height="20" /> Waiting for host to advance...'
    display.appendChild(div)
  }

  _showConfetti (container) {
    if (!container) return
    const canvas = document.createElement('canvas')
    canvas.className = 'confetti-canvas'
    canvas.width = container.offsetWidth
    canvas.height = container.offsetHeight
    container.appendChild(canvas)

    const ctx = canvas.getContext('2d')
    const colors = ['#16a34a', '#2193b0', '#f9a825', '#e91e63', '#9c27b0', '#ff5722']
    const pieces = []

    for (let i = 0; i < 80; i++) {
      pieces.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height * -1,
        w: Math.random() * 8 + 4,
        h: Math.random() * 4 + 2,
        color: colors[Math.floor(Math.random() * colors.length)],
        vx: (Math.random() - 0.5) * 4,
        vy: Math.random() * 3 + 2,
        rot: Math.random() * Math.PI * 2,
        rotV: (Math.random() - 0.5) * 0.2
      })
    }

    let frame = 0
    const maxFrames = 120

    const animate = () => {
      frame++
      if (frame > maxFrames) {
        canvas.remove()
        return
      }
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.globalAlpha = frame > maxFrames - 30 ? (maxFrames - frame) / 30 : 1

      for (const p of pieces) {
        p.x += p.vx
        p.y += p.vy
        p.vy += 0.05
        p.rot += p.rotV

        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rot)
        ctx.fillStyle = p.color
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h)
        ctx.restore()
      }
      requestAnimationFrame(animate)
    }
    requestAnimationFrame(animate)
  }

  _showWrongEffect (container) {
    if (!container) return
    const flash = document.createElement('div')
    flash.className = 'wrong-flash'
    container.appendChild(flash)
    flash.addEventListener('animationend', () => flash.remove())

    const display = document.getElementById('js-score-display')
    if (display) {
      display.style.animation = 'none'
      display.offsetHeight // force reflow
      display.style.animation = 'wrongShake 0.5s ease-out, scoreSlideDown 0.35s ease-out'
    }
  }
}
