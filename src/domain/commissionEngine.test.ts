import { describe, expect, it } from 'vitest'
import { defaultCommissionConfig } from '@/config/commissionConfig'
import {
  CommissionError,
  calculateCommission,
  calculateReferralCommission,
} from './commissionEngine'
import { toCents } from './money'

const { sale } = defaultCommissionConfig
const split = (dollars: number) => calculateCommission({ saleAmount: toCents(dollars), ...sale })

describe('calculateCommission', () => {
  it('splits a $1,000 sale as retailer $300 / distributor $100 / company $20', () => {
    const result = split(1000)
    expect(result.retailer).toBe(toCents(300))
    expect(result.distributor).toBe(toCents(100))
    expect(result.company).toBe(toCents(20))
  })

  it('represents the unallocated remainder explicitly', () => {
    const result = split(1000)
    expect(result.remainder).toBe(toCents(580))
    expect(result.remainderPercentage).toBe(58)
  })

  it('matches the $2,500 and $10,000 examples from the brief', () => {
    expect(split(2500)).toMatchObject({ retailer: 75_000, distributor: 25_000, company: 5_000 })
    expect(split(10_000).company).toBe(toCents(200))
  })

  it('always adds back up to the sale amount, even with awkward rounding', () => {
    for (const cents of [1, 7, 99, 12_345, 99_999, 1_000_001]) {
      const r = calculateCommission({ saleAmount: cents, ...sale })
      expect(r.retailer + r.distributor + r.company + r.remainder).toBe(cents)
    }
  })

  it('never produces a negative remainder when percentages total 100%', () => {
    const r = calculateCommission({
      saleAmount: 101,
      retailerPercentage: 33.33,
      distributorPercentage: 33.33,
      companyPercentage: 33.34,
    })
    expect(r.remainder).toBeGreaterThanOrEqual(0)
    expect(r.retailer + r.distributor + r.company + r.remainder).toBe(101)
  })

  it('uses whatever percentages it is given (configurable, nothing hard-coded)', () => {
    const r = calculateCommission({
      saleAmount: 10_000,
      retailerPercentage: 50,
      distributorPercentage: 20,
      companyPercentage: 5,
    })
    expect([r.retailer, r.distributor, r.company, r.remainder]).toEqual([5_000, 2_000, 500, 2_500])
  })

  it('handles a zero-value sale', () => {
    expect(split(0)).toMatchObject({ retailer: 0, distributor: 0, company: 0, remainder: 0 })
  })

  it.each([
    ['negative amount', { saleAmount: -1 }],
    ['fractional cents', { saleAmount: 10.5 }],
    ['negative percentage', { retailerPercentage: -5 }],
    ['NaN percentage', { distributorPercentage: Number.NaN }],
    ['percentages above 100 in total', { retailerPercentage: 90, distributorPercentage: 20 }],
  ])('rejects invalid input: %s', (_label, override) => {
    expect(() => calculateCommission({ saleAmount: 1000, ...sale, ...override })).toThrow(
      CommissionError,
    )
  })
})

describe('calculateReferralCommission', () => {
  it('pays 10% of a $500 fee = $50', () => {
    expect(calculateReferralCommission(toCents(500), 10)).toBe(toCents(50))
  })

  it('rejects an invalid fee', () => {
    expect(() => calculateReferralCommission(-100, 10)).toThrow(CommissionError)
  })
})
