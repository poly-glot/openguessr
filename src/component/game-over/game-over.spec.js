import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { GameOver } from './index.js'

describe('GameOver', () => {
  let el

  beforeEach(() => {
    el = document.createElement('game-over')
    document.body.appendChild(el)
  })

  afterEach(() => {
    el.remove()
  })

  it('is registered as a custom element', () => {
    expect(customElements.get('game-over')).toBe(GameOver)
  })

  it('has correct default property values', () => {
    expect(el.players).toEqual([])
    expect(el.currentUid).toBeNull()
    expect(el.totalRounds).toBe(5)
  })

  it('renders Game Over title', async () => {
    await el.updateComplete
    const title = el.renderRoot.querySelector('.game-over__title')
    expect(title.textContent).toBe('Game Over!')
  })

  it('renders winner name when players are provided', async () => {
    el.players = [
      { uid: 'p1', name: 'Alice', score: 5000, isHost: true },
      { uid: 'p2', name: 'Bob', score: 3000, isHost: false }
    ]
    el.currentUid = 'p2'
    await el.updateComplete

    const winner = el.renderRoot.querySelector('[data-cy="winner"]')
    expect(winner.textContent.trim()).toBe('Alice wins!')
  })

  it('shows "You win!" when current user is the winner', async () => {
    el.players = [
      { uid: 'p1', name: 'Alice', score: 5000, isHost: false },
      { uid: 'p2', name: 'Bob', score: 3000, isHost: false }
    ]
    el.currentUid = 'p1'
    await el.updateComplete

    const winner = el.renderRoot.querySelector('[data-cy="winner"]')
    expect(winner.textContent.trim()).toBe('You win!')
  })

  it('renders correct number of player rows in table', async () => {
    el.players = [
      { uid: 'p1', name: 'Alice', score: 5000, isHost: true },
      { uid: 'p2', name: 'Bob', score: 3000, isHost: false },
      { uid: 'p3', name: 'Charlie', score: 1000, isHost: false }
    ]
    await el.updateComplete

    const rows = el.renderRoot.querySelectorAll('tbody tr')
    expect(rows.length).toBe(3)
  })

  it('highlights current player row', async () => {
    el.players = [
      { uid: 'p1', name: 'Alice', score: 5000, isHost: false },
      { uid: 'p2', name: 'Bob', score: 3000, isHost: false }
    ]
    el.currentUid = 'p2'
    await el.updateComplete

    const rows = el.renderRoot.querySelectorAll('tbody tr')
    expect(rows[1].classList.contains('game-over__row--self')).toBe(true)
    expect(rows[0].classList.contains('game-over__row--self')).toBe(false)
  })

  it('shows correct max score based on totalRounds', async () => {
    el.totalRounds = 10
    el.players = [
      { uid: 'p1', name: 'Alice', score: 5000, isHost: false }
    ]
    await el.updateComplete

    const scoreCell = el.renderRoot.querySelector('tbody td:last-child')
    expect(scoreCell.textContent).toContain('/ 50000')
  })

  it('shows rank numbers', async () => {
    el.players = [
      { uid: 'p1', name: 'Alice', score: 5000, isHost: false },
      { uid: 'p2', name: 'Bob', score: 3000, isHost: false }
    ]
    await el.updateComplete

    const firstRow = el.renderRoot.querySelectorAll('tbody tr')[0]
    const secondRow = el.renderRoot.querySelectorAll('tbody tr')[1]
    expect(firstRow.querySelector('td').textContent).toBe('1')
    expect(secondRow.querySelector('td').textContent).toBe('2')
  })

  it('shows (host) next to host player name', async () => {
    el.players = [
      { uid: 'p1', name: 'Alice', score: 5000, isHost: true }
    ]
    await el.updateComplete

    const nameCell = el.renderRoot.querySelectorAll('tbody td')[1]
    expect(nameCell.textContent).toContain('(host)')
  })

  it('renders Play Again button', async () => {
    await el.updateComplete
    const btn = el.renderRoot.querySelector('[data-cy="play-again"]')
    expect(btn).toBeTruthy()
    expect(btn.textContent).toBe('Play Again')
  })

  it('renders table headers', async () => {
    await el.updateComplete
    const headers = el.renderRoot.querySelectorAll('th')
    expect(headers.length).toBe(3)
    expect(headers[0].textContent).toBe('Rank')
    expect(headers[1].textContent).toBe('Player')
    expect(headers[2].textContent).toBe('Score')
  })

  it('handles empty players array', async () => {
    el.players = []
    await el.updateComplete
    const rows = el.renderRoot.querySelectorAll('tbody tr')
    expect(rows.length).toBe(0)
    const winner = el.renderRoot.querySelector('[data-cy="winner"]')
    expect(winner).toBeNull()
  })
})
