import { describe, expect, it } from 'vitest'
import { defaultCommissionConfig } from '@/config/commissionConfig'
import type { Distributor, Retailer } from '@/types'
import { assessOnboardings, getDailyProgress } from './onboardingRules'

const config = defaultCommissionConfig // Asia/Kolkata (UTC+5:30), $50 bonus, target 2

const distributor: Distributor = {
  id: 'DIST-001',
  name: 'Asha',
  state: 'Tamil Nadu',
  city: 'Chennai',
  parentId: null,
  position: null,
  referredBy: null,
  retailerIds: [],
  dailyTarget: 2,
  joinedAt: '2026-01-01T00:00:00.000Z',
}

// 2026-09-21 14:00 IST
const now = new Date('2026-09-21T08:30:00.000Z')

let counter = 0
const retailer = (overrides: Partial<Retailer> = {}): Retailer => ({
  id: `RET-${++counter}`,
  name: 'Shop',
  distributorId: 'DIST-001',
  state: 'Tamil Nadu',
  city: 'Chennai',
  onboardedAt: '2026-09-21T05:00:00.000Z', // 10:30 IST today
  status: 'ACTIVE',
  ...overrides,
})

const progress = (retailers: Retailer[], d: Distributor = distributor) =>
  getDailyProgress(retailers, d, { now, config })

describe('getDailyProgress', () => {
  it('2 qualifying onboardings today = 100% and $100 bonus', () => {
    const p = progress([retailer(), retailer()])
    expect(p).toMatchObject({
      target: 2,
      completed: 2,
      achievementPct: 100,
      remaining: 0,
      bonus: 10_000,
    })
  })

  it('reports remaining target and partial achievement', () => {
    const p = progress([retailer()])
    expect(p).toMatchObject({ completed: 1, achievementPct: 50, remaining: 1, bonus: 5_000 })
  })

  it('does not count onboardings from other days', () => {
    expect(progress([retailer({ onboardedAt: '2026-09-20T05:00:00.000Z' })]).completed).toBe(0)
  })

  describe('date boundaries in the business time zone', () => {
    it('counts 23:59 IST the previous evening as yesterday', () => {
      // 2026-09-20 23:59 IST = 2026-09-20T18:29Z
      expect(progress([retailer({ onboardedAt: '2026-09-20T18:29:00.000Z' })]).completed).toBe(0)
    })

    it('counts 00:01 IST this morning as today, even though it is still "yesterday" in UTC', () => {
      // 2026-09-21 00:01 IST = 2026-09-20T18:31Z
      expect(progress([retailer({ onboardedAt: '2026-09-20T18:31:00.000Z' })]).completed).toBe(1)
    })
  })

  it('ignores cancelled and deactivated retailers', () => {
    const p = progress([
      retailer({ status: 'CANCELLED' }),
      retailer({ status: 'DEACTIVATED' }),
      retailer(),
    ])
    expect(p.completed).toBe(1)
    expect(p.excluded.map((e) => e.exclusion).sort()).toEqual(['CANCELLED', 'DEACTIVATED'])
  })

  it('counts duplicate records (same id or same phone) once', () => {
    const original = retailer({ id: 'RET-DUP', phone: '+91 98765 43210' })
    const sameId = retailer({ id: 'RET-DUP', onboardedAt: '2026-09-21T06:00:00.000Z' })
    const samePhone = retailer({ phone: '9876543210', onboardedAt: '2026-09-21T07:00:00.000Z' })
    const p = progress([original, sameId, samePhone])
    expect(p.completed).toBe(1)
    expect(p.excluded.every((e) => e.exclusion === 'DUPLICATE')).toBe(true)
  })

  it('rejects invalid, future and pre-joining onboardings', () => {
    const results = assessOnboardings(
      [
        retailer({ onboardedAt: 'not-a-date' }),
        retailer({ onboardedAt: '2026-09-22T05:00:00.000Z' }),
        retailer({ onboardedAt: '2025-12-31T00:00:00.000Z' }),
        retailer({ distributorId: 'DIST-999' }),
      ],
      distributor,
      { now, config },
    )
    expect(results.map((r) => r.exclusion)).toEqual([
      'INVALID_DATE',
      'FUTURE_DATE',
      'BEFORE_JOINING',
      'WRONG_DISTRIBUTOR',
    ])
  })

  it('pays for every qualifying onboarding by default, or caps at target when configured', () => {
    const three = [retailer(), retailer(), retailer()]
    expect(progress(three).bonus).toBe(15_000)
    const capped = getDailyProgress(three, distributor, {
      now,
      config: { ...config, onboarding: { ...config.onboarding, capBonusAtTarget: true } },
    })
    expect(capped.bonus).toBe(10_000)
  })

  it('handles a zero target without dividing by zero', () => {
    expect(progress([retailer()], { ...distributor, dailyTarget: 0 }).achievementPct).toBe(0)
  })
})
