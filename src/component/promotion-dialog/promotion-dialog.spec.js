import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { PromotionDialog } from './index.js'

describe('PromotionDialog', () => {
  let el

  beforeEach(() => {
    vi.useFakeTimers()
    el = document.createElement('promotion-dialog')
    document.body.appendChild(el)
  })

  afterEach(() => {
    el.remove()
    vi.useRealTimers()
  })

  it('is registered as a custom element', () => {
    expect(customElements.get('promotion-dialog')).toBe(PromotionDialog)
  })

  it('has correct default property values', () => {
    expect(el.data).toBeNull()
    expect(el.currentUid).toBeNull()
    expect(el._remaining).toBe(60)
    expect(el._resolved).toBe(false)
  })

  it('renders empty when data is null', async () => {
    await el.updateComplete
    const dialog = el.renderRoot.querySelector('dialog')
    expect(dialog).toBeNull()
  })

  // ── _updateRemaining ────────────────────────────────────────

  describe('_updateRemaining', () => {
    it('calculates remaining seconds from expiresAt', async () => {
      const now = Date.now()
      el.data = {
        status: 'pending',
        expiresAt: now + 30000,
        requesterName: 'Alice',
        requesterId: 'uid1',
        memberCount: 3,
        votes: {}
      }
      await el.updateComplete

      el._updateRemaining()
      expect(el._remaining).toBe(30)
    })

    it('clamps to 0 when expired', async () => {
      const now = Date.now()
      el.data = {
        status: 'pending',
        expiresAt: now - 5000,
        requesterName: 'Alice',
        requesterId: 'uid1',
        memberCount: 2,
        votes: {}
      }
      await el.updateComplete

      el._updateRemaining()
      expect(el._remaining).toBe(0)
    })

    it('returns early when data is null', () => {
      el.data = null
      el._remaining = 42
      el._updateRemaining()
      expect(el._remaining).toBe(42)
    })
  })

  // ── Vote tallying ─────────────────────────────────────────

  describe('_getVoteStats', () => {
    it('counts approvals and rejections', async () => {
      el.data = {
        status: 'pending',
        expiresAt: Date.now() + 30000,
        requesterName: 'Alice',
        requesterId: 'uid1',
        memberCount: 4,
        votes: {
          uid1: { vote: true, name: 'Alice' },
          uid2: { vote: false, name: 'Bob' },
          uid3: { vote: true, name: 'Charlie' }
        }
      }
      await el.updateComplete

      const stats = el._getVoteStats()
      expect(stats.approveCount).toBe(2)
      expect(stats.rejectCount).toBe(1)
      expect(stats.pendingCount).toBe(1)
    })

    it('handles empty votes', async () => {
      el.data = {
        status: 'pending',
        expiresAt: Date.now() + 30000,
        requesterName: 'Alice',
        requesterId: 'uid1',
        memberCount: 3,
        votes: {}
      }
      await el.updateComplete

      const stats = el._getVoteStats()
      expect(stats.approveCount).toBe(0)
      expect(stats.rejectCount).toBe(0)
      expect(stats.pendingCount).toBe(3)
    })

    it('handles null data gracefully', () => {
      el.data = null
      const stats = el._getVoteStats()
      expect(stats.approveCount).toBe(0)
      expect(stats.rejectCount).toBe(0)
      expect(stats.pendingCount).toBe(0)
    })
  })

  // ── Timer class ─────────────────────────────────────────────

  describe('_getTimerClass', () => {
    it('returns empty string when > 20 seconds', () => {
      el._remaining = 30
      expect(el._getTimerClass()).toBe('')
    })

    it('returns warning when <= 20 and > 10', () => {
      el._remaining = 15
      expect(el._getTimerClass()).toBe('warning')
    })

    it('returns urgent when <= 10', () => {
      el._remaining = 5
      expect(el._getTimerClass()).toBe('urgent')
    })
  })

  // ── Countdown ─────────────────────────────────────────────

  describe('countdown', () => {
    it('starts countdown when pending data is set', async () => {
      const now = Date.now()
      el.data = {
        status: 'pending',
        expiresAt: now + 30000,
        requesterName: 'Alice',
        requesterId: 'uid1',
        memberCount: 2,
        votes: { uid1: { vote: true, name: 'Alice' } }
      }
      await el.updateComplete

      expect(el._interval).not.toBeNull()
      expect(el._remaining).toBe(30)
    })

    it('decrements remaining on each tick', async () => {
      const now = Date.now()
      el.data = {
        status: 'pending',
        expiresAt: now + 30000,
        requesterName: 'Alice',
        requesterId: 'uid1',
        memberCount: 2,
        votes: {}
      }
      await el.updateComplete

      vi.advanceTimersByTime(5000)
      expect(el._remaining).toBe(25)
    })

    it('dispatches promotion-expired when countdown reaches 0', async () => {
      const handler = vi.fn()
      el.addEventListener('promotion-expired', handler)

      const now = Date.now()
      el.data = {
        status: 'pending',
        expiresAt: now + 2000,
        requesterName: 'Alice',
        requesterId: 'uid1',
        memberCount: 2,
        roomId: 'room1',
        votes: {}
      }
      await el.updateComplete

      vi.advanceTimersByTime(3000)
      expect(handler).toHaveBeenCalled()
    })

    it('clears interval on disconnect', async () => {
      const now = Date.now()
      el.data = {
        status: 'pending',
        expiresAt: now + 30000,
        requesterName: 'Alice',
        requesterId: 'uid1',
        memberCount: 2,
        votes: {}
      }
      await el.updateComplete
      expect(el._interval).not.toBeNull()

      el.remove()
      expect(el._interval).toBeNull()
    })
  })

  // ── Auto-close ─────────────────────────────────────────────

  describe('auto-close on resolution', () => {
    it('schedules auto-close when status changes to approved', async () => {
      const closeSpy = vi.spyOn(el, 'close')

      el.data = {
        status: 'pending',
        expiresAt: Date.now() + 30000,
        requesterName: 'Alice',
        requesterId: 'uid1',
        memberCount: 2,
        votes: { uid1: { vote: true, name: 'Alice' } }
      }
      await el.updateComplete

      el.data = {
        ...el.data,
        status: 'approved'
      }
      await el.updateComplete

      expect(el._resolved).toBe(true)

      vi.advanceTimersByTime(5000)
      expect(closeSpy).toHaveBeenCalled()
    })

    it('schedules auto-close when status changes to denied', async () => {
      const closeSpy = vi.spyOn(el, 'close')

      el.data = {
        status: 'pending',
        expiresAt: Date.now() + 30000,
        requesterName: 'Alice',
        requesterId: 'uid1',
        memberCount: 2,
        votes: { uid1: { vote: true, name: 'Alice' } }
      }
      await el.updateComplete

      el.data = { ...el.data, status: 'denied' }
      await el.updateComplete

      expect(el._resolved).toBe(true)

      vi.advanceTimersByTime(5000)
      expect(closeSpy).toHaveBeenCalled()
    })
  })

  // ── Voting ─────────────────────────────────────────────────

  describe('voting', () => {
    it('dispatches promotion-vote on approve click', async () => {
      const handler = vi.fn()
      el.addEventListener('promotion-vote', handler)

      el.data = {
        status: 'pending',
        expiresAt: Date.now() + 30000,
        requesterName: 'Alice',
        requesterId: 'uid1',
        memberCount: 3,
        votes: { uid1: { vote: true, name: 'Alice' } }
      }
      el.currentUid = 'uid2'
      await el.updateComplete

      const approveBtn = el.renderRoot.querySelector('[data-cy="promotion-approve"]')
      expect(approveBtn).toBeTruthy()
      approveBtn.click()

      expect(handler).toHaveBeenCalledTimes(1)
      expect(handler.mock.calls[0][0].detail.vote).toBe(true)
    })

    it('dispatches promotion-vote on reject click', async () => {
      const handler = vi.fn()
      el.addEventListener('promotion-vote', handler)

      el.data = {
        status: 'pending',
        expiresAt: Date.now() + 30000,
        requesterName: 'Alice',
        requesterId: 'uid1',
        memberCount: 3,
        votes: { uid1: { vote: true, name: 'Alice' } }
      }
      el.currentUid = 'uid2'
      await el.updateComplete

      const rejectBtn = el.renderRoot.querySelector('[data-cy="promotion-reject"]')
      rejectBtn.click()

      expect(handler).toHaveBeenCalledTimes(1)
      expect(handler.mock.calls[0][0].detail.vote).toBe(false)
    })

    it('disables buttons after voting', async () => {
      el.currentUid = 'uid2'
      el.data = {
        status: 'pending',
        expiresAt: Date.now() + 30000,
        requesterName: 'Alice',
        requesterId: 'uid1',
        memberCount: 3,
        votes: {
          uid1: { vote: true, name: 'Alice' },
          uid2: { vote: true, name: 'Bob' }
        }
      }
      await el.updateComplete
      // _hasVoted is set in updated(), which triggers a second render cycle
      await el.updateComplete

      const approveBtn = el.renderRoot.querySelector('[data-cy="promotion-approve"]')
      const rejectBtn = el.renderRoot.querySelector('[data-cy="promotion-reject"]')
      expect(approveBtn.disabled).toBe(true)
      expect(rejectBtn.disabled).toBe(true)
    })
  })

  // ── Render ─────────────────────────────────────────────────

  describe('render', () => {
    it('displays requester name', async () => {
      el.data = {
        status: 'pending',
        expiresAt: Date.now() + 30000,
        requesterName: 'TestPlayer',
        requesterId: 'uid1',
        memberCount: 2,
        votes: { uid1: { vote: true, name: 'TestPlayer' } }
      }
      await el.updateComplete

      const name = el.renderRoot.querySelector('[data-cy="promotion-requester"]')
      expect(name.textContent).toBe('TestPlayer')
    })

    it('shows vote counts', async () => {
      el.data = {
        status: 'pending',
        expiresAt: Date.now() + 30000,
        requesterName: 'Alice',
        requesterId: 'uid1',
        memberCount: 4,
        votes: {
          uid1: { vote: true, name: 'Alice' },
          uid2: { vote: false, name: 'Bob' }
        }
      }
      await el.updateComplete

      expect(el.renderRoot.querySelector('[data-cy="promotion-approve-count"]').textContent).toBe('1')
      expect(el.renderRoot.querySelector('[data-cy="promotion-reject-count"]').textContent).toBe('1')
      expect(el.renderRoot.querySelector('[data-cy="promotion-pending-count"]').textContent).toBe('2')
    })

    it('shows approved result text', async () => {
      el.data = {
        status: 'approved',
        expiresAt: Date.now() + 30000,
        requesterName: 'Alice',
        requesterId: 'uid1',
        memberCount: 2,
        votes: { uid1: { vote: true, name: 'Alice' } }
      }
      await el.updateComplete
      // _resolved set in updated() triggers second render
      await el.updateComplete

      const result = el.renderRoot.querySelector('[data-cy="promotion-result"]')
      expect(result).toBeTruthy()
      expect(result.textContent).toContain('promoted to host')
      expect(result.classList.contains('approved')).toBe(true)
    })

    it('shows denied result text', async () => {
      el.data = {
        status: 'denied',
        expiresAt: Date.now() + 30000,
        requesterName: 'Alice',
        requesterId: 'uid1',
        memberCount: 2,
        votes: { uid1: { vote: true, name: 'Alice' } }
      }
      await el.updateComplete
      await el.updateComplete

      const result = el.renderRoot.querySelector('[data-cy="promotion-result"]')
      expect(result).toBeTruthy()
      expect(result.textContent).toContain('was denied')
      expect(result.classList.contains('denied')).toBe(true)
    })

    it('hides timer ring when resolved', async () => {
      el.data = {
        status: 'approved',
        expiresAt: Date.now() + 30000,
        requesterName: 'Alice',
        requesterId: 'uid1',
        memberCount: 2,
        votes: { uid1: { vote: true, name: 'Alice' } }
      }
      await el.updateComplete
      await el.updateComplete

      const timerRing = el.renderRoot.querySelector('.timer-ring')
      expect(timerRing).toBeNull()
    })

    it('shows countdown when pending', async () => {
      el.data = {
        status: 'pending',
        expiresAt: Date.now() + 45000,
        requesterName: 'Alice',
        requesterId: 'uid1',
        memberCount: 2,
        votes: {}
      }
      await el.updateComplete

      const countdown = el.renderRoot.querySelector('[data-cy="promotion-countdown"]')
      expect(countdown).toBeTruthy()
      expect(Number(countdown.textContent)).toBeGreaterThan(0)
    })

    it('shows vote entries for each voter', async () => {
      el.data = {
        status: 'pending',
        expiresAt: Date.now() + 30000,
        requesterName: 'Alice',
        requesterId: 'uid1',
        memberCount: 3,
        votes: {
          uid1: { vote: true, name: 'Alice' },
          uid2: { vote: false, name: 'Bob' }
        }
      }
      await el.updateComplete

      const entries = el.renderRoot.querySelectorAll('.vote-entry')
      // 2 actual votes + 1 pending placeholder
      expect(entries.length).toBe(3)
    })
  })

  // ── Progress offset ────────────────────────────────────────

  describe('_getProgressOffset', () => {
    it('returns 0 when full time remains', () => {
      el._remaining = 60
      el._totalDuration = 60
      expect(el._getProgressOffset()).toBeCloseTo(0)
    })

    it('returns full circumference when time is 0', () => {
      el._remaining = 0
      el._totalDuration = 60
      const circumference = 2 * Math.PI * 52
      expect(el._getProgressOffset()).toBeCloseTo(circumference)
    })

    it('returns half circumference at halfway', () => {
      el._remaining = 30
      el._totalDuration = 60
      const circumference = 2 * Math.PI * 52
      expect(el._getProgressOffset()).toBeCloseTo(circumference / 2)
    })
  })
})
