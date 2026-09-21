// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { defaultCommissionConfig as config } from '@/config/commissionConfig'
import { buildLedger } from '@/domain/ledger'
import { buildDistributorSummaries, computeDashboardMetrics } from '@/domain/metrics'
import { scopeByState } from '@/domain/scope'
import { buildForest } from '@/domain/treeBuilder'
import { generateSeed } from './seed'

const now = new Date('2026-09-21T08:30:00.000Z') // 14:00 IST
const seed = generateSeed(now)
const ledger = buildLedger({ ...seed, now, config })
const data = { ...seed, ledger }
const summaries = buildDistributorSummaries(data, { now, config })

describe('seed data', () => {
  it('is deterministic', () => {
    expect(generateSeed(now)).toEqual(seed)
  })

  it('forms a valid binary forest with no data issues', () => {
    const { roots, issues } = buildForest(seed.distributors)
    expect(issues).toEqual([])
    expect(roots).toHaveLength(3)
  })

  it('every sale splits back to its amount (nothing silently lost)', () => {
    for (const s of seed.sales) {
      expect(
        s.retailerCommission + s.distributorCommission + s.companyCommission + s.remainder,
      ).toBe(s.amount)
    }
  })

  it('never invents sales for cancelled or invalid retailers', () => {
    const blocked = new Set(
      seed.retailers
        .filter((r) => r.status === 'CANCELLED' || Date.parse(r.onboardedAt) > now.getTime())
        .map((r) => r.id),
    )
    expect(seed.sales.some((s) => blocked.has(s.retailerId))).toBe(false)
  })
})

describe('planted business-rule cases', () => {
  it('DIST-001 hits its target: 2 completed, $100 bonus', () => {
    expect(summaries.get('DIST-001')?.progress).toMatchObject({
      completed: 2,
      achievementPct: 100,
      bonus: 10_000,
    })
  })

  it('DIST-002 does not count the 23:59 IST onboarding from yesterday', () => {
    expect(summaries.get('DIST-002')?.progress.completed).toBe(1)
  })

  it('DIST-003 over-achieves and excludes its cancelled and duplicate records', () => {
    const progress = summaries.get('DIST-003')!.progress
    expect(progress.completed).toBe(3)
    expect(progress.excluded.map((e) => e.exclusion).sort()).toEqual(
      expect.arrayContaining(['CANCELLED', 'DUPLICATE']),
    )
  })

  it('DIST-004 counts the 00:01 IST onboarding as today', () => {
    expect(summaries.get('DIST-004')?.progress.completed).toBeGreaterThanOrEqual(1)
  })
})

describe('metrics', () => {
  const all = computeDashboardMetrics(data, summaries, { now, config })

  it('company downline commission is 2% of total sales', () => {
    const totalSales = seed.sales.reduce((sum, s) => sum + s.amount, 0)
    expect(Math.abs(all.companyCommission - totalSales * 0.02)).toBeLessThanOrEqual(
      seed.sales.length,
    )
  })

  it('total commissions equal the sum of the four categories', () => {
    expect(all.totalCommissions).toBe(
      all.distributorCommissions +
        all.retailerCommissions +
        all.referralCommissions +
        all.companyCommission,
    )
  })

  it('a state filter narrows every figure and the parts still add up to the whole', () => {
    const states = [...new Set(seed.distributors.map((d) => d.state))]
    const perState = states.map((state) => {
      const scoped = scopeByState(data, state)
      return computeDashboardMetrics(scoped, buildDistributorSummaries(scoped, { now, config }), {
        now,
        config,
      })
    })
    expect(perState.reduce((n, m) => n + m.totalDistributors, 0)).toBe(all.totalDistributors)
    expect(perState.reduce((n, m) => n + m.retailerCommissions, 0)).toBe(all.retailerCommissions)
    expect(perState.reduce((n, m) => n + m.totalCommissions, 0)).toBe(all.totalCommissions)
  })
})
