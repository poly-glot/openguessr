import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { GameLeaderboard } from './index.js'

describe('GameLeaderboard', () => {
  let el

  beforeEach(() => {
    el = document.createElement('game-leaderboard')
    document.body.appendChild(el)
  })

  afterEach(() => {
    el.remove()
  })

  it('is registered as a custom element', () => {
    expect(customElements.get('game-leaderboard')).toBe(GameLeaderboard)
  })

  it('has correct default property values', () => {
    expect(el.players).toEqual({})
    expect(el.hostId).toBeNull()
    expect(el.currentUid).toBeNull()
    expect(el.isHost).toBe(false)
    expect(el.roomId).toBeNull()
  })

  it('renders leaderboard title', async () => {
    await el.updateComplete
    const title = el.renderRoot.querySelector('.leaderboard__title')
    expect(title.textContent).toBe('Leaderboard')
  })

  it('renders player entries sorted by score descending', async () => {
    el.players = {
      uid1: { name: 'Alice', score: 500 },
      uid2: { name: 'Bob', score: 1000 },
      uid3: { name: 'Charlie', score: 750 }
    }
    await el.updateComplete

    const names = el.renderRoot.querySelectorAll('.leaderboard__name')
    expect(names[0].textContent.trim()).toBe('Bob')
    expect(names[1].textContent.trim()).toBe('Charlie')
    expect(names[2].textContent.trim()).toBe('Alice')
  })

  it('sorts by name when scores are equal', async () => {
    el.players = {
      uid1: { name: 'Charlie', score: 500 },
      uid2: { name: 'Alice', score: 500 }
    }
    await el.updateComplete

    const names = el.renderRoot.querySelectorAll('.leaderboard__name')
    expect(names[0].textContent.trim()).toBe('Alice')
    expect(names[1].textContent.trim()).toBe('Charlie')
  })

  it('sorts host first regardless of score', async () => {
    el.players = {
      uid1: { name: 'Alice', score: 500 },
      uid2: { name: 'Bob', score: 1000 },
      uid3: { name: 'Charlie', score: 750 }
    }
    el.hostId = 'uid1'
    await el.updateComplete

    const names = el.renderRoot.querySelectorAll('.leaderboard__name')
    expect(names[0].textContent.trim()).toBe('Alice')
    expect(names[1].textContent.trim()).toBe('Bob')
    expect(names[2].textContent.trim()).toBe('Charlie')
  })

  it('sorts non-host players by score desc then name asc after host', async () => {
    el.players = {
      uid1: { name: 'Alice', score: 200 },
      uid2: { name: 'Bob', score: 800 },
      uid3: { name: 'Charlie', score: 800 },
      uid4: { name: 'Dave', score: 500 }
    }
    el.hostId = 'uid4'
    await el.updateComplete

    const names = el.renderRoot.querySelectorAll('.leaderboard__name')
    expect(names[0].textContent.trim()).toBe('Dave')
    expect(names[1].textContent.trim()).toBe('Bob')
    expect(names[2].textContent.trim()).toBe('Charlie')
    expect(names[3].textContent.trim()).toBe('Alice')
  })

  it('shows rank numbers', async () => {
    el.players = {
      uid1: { name: 'Alice', score: 1000 },
      uid2: { name: 'Bob', score: 500 }
    }
    await el.updateComplete

    const ranks = el.renderRoot.querySelectorAll('.leaderboard__rank')
    expect(ranks[0].textContent.trim()).toBe('1.')
    expect(ranks[1].textContent.trim()).toBe('2.')
  })

  it('highlights current user entry', async () => {
    el.players = { uid1: { name: 'Alice', score: 1000 } }
    el.currentUid = 'uid1'
    await el.updateComplete

    const entry = el.renderRoot.querySelector('.leaderboard__entry')
    expect(entry.classList.contains('leaderboard__entry--self')).toBe(true)
  })

  it('does not highlight non-current user entries', async () => {
    el.players = { uid1: { name: 'Alice', score: 1000 } }
    el.currentUid = 'uid2'
    await el.updateComplete

    const entry = el.renderRoot.querySelector('.leaderboard__entry')
    expect(entry.classList.contains('leaderboard__entry--self')).toBe(false)
  })

  it('marks host with host class', async () => {
    el.players = { uid1: { name: 'Alice', score: 1000 } }
    el.hostId = 'uid1'
    await el.updateComplete

    const name = el.renderRoot.querySelector('.leaderboard__name')
    expect(name.classList.contains('leaderboard__name--host')).toBe(true)
  })

  it('does not show Make Host button', async () => {
    el.players = {
      uid1: { name: 'Alice', score: 1000 },
      uid2: { name: 'Bob', score: 500 }
    }
    el.currentUid = 'uid1'
    el.isHost = true
    await el.updateComplete

    const makeHostBtns = el.renderRoot.querySelectorAll('[data-cy="make-host"]')
    expect(makeHostBtns.length).toBe(0)
  })

  it('displays scores', async () => {
    el.players = { uid1: { name: 'Alice', score: 1500 } }
    await el.updateComplete

    const score = el.renderRoot.querySelector('[data-cy="player-score"]')
    expect(score.textContent.trim()).toBe('1500')
  })

  it('uses uid as name fallback when name is missing', async () => {
    el.players = { uid1: { score: 100 } }
    await el.updateComplete

    const name = el.renderRoot.querySelector('.leaderboard__name')
    expect(name.textContent.trim()).toBe('uid1')
  })

  it('defaults score to 0 when missing', async () => {
    el.players = { uid1: { name: 'Alice' } }
    await el.updateComplete

    const score = el.renderRoot.querySelector('[data-cy="player-score"]')
    expect(score.textContent.trim()).toBe('0')
  })

  it('handles null players gracefully', async () => {
    el.players = null
    await el.updateComplete

    const entries = el.renderRoot.querySelectorAll('.leaderboard__entry')
    expect(entries.length).toBe(0)
  })

  it('_getEntries returns sorted array with host first', () => {
    el.players = {
      uid1: { name: 'Alice', score: 300 },
      uid2: { name: 'Bob', score: 600 }
    }
    el.hostId = 'uid1'

    const entries = el._getEntries()
    expect(entries.length).toBe(2)
    expect(entries[0].uid).toBe('uid1')
    expect(entries[0].isHost).toBe(true)
    expect(entries[1].uid).toBe('uid2')
    expect(entries[1].score).toBe(600)
  })

  it('shows request host button for non-host with multiple players', async () => {
    el.players = {
      uid1: { name: 'Alice', score: 1000 },
      uid2: { name: 'Bob', score: 500 }
    }
    el.currentUid = 'uid2'
    el.isHost = false
    await el.updateComplete

    const requestBtn = el.renderRoot.querySelector('[data-cy="request-host"]')
    expect(requestBtn).toBeTruthy()
  })

  it('does not show request host button when user is host', async () => {
    el.players = {
      uid1: { name: 'Alice', score: 1000 },
      uid2: { name: 'Bob', score: 500 }
    }
    el.currentUid = 'uid1'
    el.isHost = true
    await el.updateComplete

    const requestBtn = el.renderRoot.querySelector('[data-cy="request-host"]')
    expect(requestBtn).toBeFalsy()
  })

  it('dispatches request-host event when Request Host Access clicked', async () => {
    el.players = {
      uid1: { name: 'Alice', score: 1000 },
      uid2: { name: 'Bob', score: 500 }
    }
    el.currentUid = 'uid2'
    el.isHost = false
    await el.updateComplete

    const handler = vi.fn()
    el.addEventListener('request-host', handler)

    const requestBtn = el.renderRoot.querySelector('[data-cy="request-host"]')
    requestBtn.click()

    expect(handler).toHaveBeenCalledTimes(1)
    expect(handler.mock.calls[0][0].bubbles).toBe(true)
    expect(handler.mock.calls[0][0].composed).toBe(true)
  })
})
