import type { Money } from '@/types'
import { percentOf } from './money'

export interface CommissionInput {
  /** Sale amount in cents. */
  saleAmount: Money
  retailerPercentage: number
  distributorPercentage: number
  companyPercentage: number
}

export interface CommissionBreakdown {
  saleAmount: Money
  retailer: Money
  distributor: Money
  /** Company downline commission. */
  company: Money
  /** Whatever is not allocated to the three parties. Represented explicitly, never dropped. */
  remainder: Money
  remainderPercentage: number
}

export class CommissionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CommissionError'
  }
}

function assertPercentage(name: string, value: number) {
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw new CommissionError(`${name} must be between 0 and 100, received ${value}`)
  }
}

/**
 * Split a sale between retailer, distributor and company.
 * Invariant: retailer + distributor + company + remainder === saleAmount (always, to the cent).
 */
export function calculateCommission(input: CommissionInput): CommissionBreakdown {
  const { saleAmount, retailerPercentage, distributorPercentage, companyPercentage } = input

  if (!Number.isInteger(saleAmount) || saleAmount < 0) {
    throw new CommissionError(
      `saleAmount must be a non-negative integer (cents), received ${saleAmount}`,
    )
  }
  assertPercentage('retailerPercentage', retailerPercentage)
  assertPercentage('distributorPercentage', distributorPercentage)
  assertPercentage('companyPercentage', companyPercentage)

  const totalPercentage = retailerPercentage + distributorPercentage + companyPercentage
  if (totalPercentage > 100) {
    throw new CommissionError(`Percentages add up to ${totalPercentage}%, which exceeds 100%`)
  }

  const retailer = percentOf(saleAmount, retailerPercentage)
  const distributor = percentOf(saleAmount, distributorPercentage)
  let company = percentOf(saleAmount, companyPercentage)

  let remainder = saleAmount - retailer - distributor - company
  if (remainder < 0) {
    // Rounding pushed the shares over the sale amount (only possible near 100%). Trim the company share.
    company += remainder
    remainder = 0
  }

  return {
    saleAmount,
    retailer,
    distributor,
    company,
    remainder,
    remainderPercentage: Math.round((100 - totalPercentage) * 100) / 100,
  }
}

/** Referral commission: `percentage` of the referred distributor's fee. */
export function calculateReferralCommission(fee: Money, percentage: number): Money {
  if (!Number.isInteger(fee) || fee < 0) {
    throw new CommissionError(`fee must be a non-negative integer (cents), received ${fee}`)
  }
  assertPercentage('percentage', percentage)
  return percentOf(fee, percentage)
}
