import type { CommissionConfig } from '@/config/commissionConfig'
import type { Money } from '@/types'
import { businessDayKey, parseISO } from './dateUtils'
import { getDailyProgress, type DailyProgress } from './onboardingRules'
import type { MarketplaceData } from './scope'

export interface MetricsContext {
  now: Date
  config: CommissionConfig
}

export interface DistributorSummary {
  distributorId: string
  /** Active retailers only. */
  retailerCount: number
  totalSales: Money
  /** Onboarding bonuses + the distributor's share of retailer sales. */
  distributorCommission: Money
  referralCommission: Money
  progress: DailyProgress
}

export interface DashboardMetrics {
  totalDistributors: number
  totalRetailers: number
  todaysSales: Money
  totalCommissions: Money
  distributorCommissions: Money
  retailerCommissions: Money
  referralCommissions: Money
  companyCommission: Money
  onboarding: {
    target: number
    completed: number
    achievementPct: number
    remaining: number
    bonus: Money
  }
}

const add = (map: Map<string, number>, key: string, value: number) =>
  map.set(key, (map.get(key) ?? 0) + value)

/** One pass over the data producing a summary per distributor. */
export function buildDistributorSummaries(
  data: MarketplaceData,
  context: MetricsContext,
): Map<string, DistributorSummary> {
  const salesTotal = new Map<string, number>()
  for (const sale of data.sales) add(salesTotal, sale.distributorId, sale.amount)

  const earned = new Map<string, number>()
  const referral = new Map<string, number>()
  for (const entry of data.ledger) {
    if (entry.type === 'RETAILER_SALE' || entry.type === 'ONBOARDING')
      add(earned, entry.entity, entry.amount)
    else if (entry.type === 'DISTRIBUTOR_REFERRAL') add(referral, entry.entity, entry.amount)
  }

  const retailersByDistributor = new Map<string, typeof data.retailers>()
  for (const retailer of data.retailers) {
    const list = retailersByDistributor.get(retailer.distributorId) ?? []
    list.push(retailer)
    retailersByDistributor.set(retailer.distributorId, list)
  }

  const summaries = new Map<string, DistributorSummary>()
  for (const distributor of data.distributors) {
    const own = retailersByDistributor.get(distributor.id) ?? []
    summaries.set(distributor.id, {
      distributorId: distributor.id,
      retailerCount: own.filter((r) => r.status === 'ACTIVE').length,
      totalSales: salesTotal.get(distributor.id) ?? 0,
      distributorCommission: earned.get(distributor.id) ?? 0,
      referralCommission: referral.get(distributor.id) ?? 0,
      progress: getDailyProgress(own, distributor, context),
    })
  }
  return summaries
}

export interface DailySales {
  /** Business day, yyyy-MM-dd. */
  day: string
  amount: Money
  count: number
}

/** Sales per business day for the last `days` days (oldest first), including empty days. */
export function salesByDay(
  sales: MarketplaceData['sales'],
  { now, config }: MetricsContext,
  days = 14,
): DailySales[] {
  const zone = config.businessTimeZone
  const buckets = new Map<string, DailySales>()
  for (let i = days - 1; i >= 0; i--) {
    const day = businessDayKey(new Date(now.getTime() - i * 86_400_000), zone)
    buckets.set(day, { day, amount: 0, count: 0 })
  }
  for (const sale of sales) {
    const date = parseISO(sale.date)
    const bucket = date ? buckets.get(businessDayKey(date, zone)) : undefined
    if (bucket) {
      bucket.amount += sale.amount
      bucket.count += 1
    }
  }
  return [...buckets.values()]
}

/**
 * Definitions:
 *  - Total commissions = distributor + retailer + referral + company downline commissions.
 *  - Total retailers   = active retailers.
 */
export function computeDashboardMetrics(
  data: MarketplaceData,
  summaries: ReadonlyMap<string, DistributorSummary>,
  { now, config }: MetricsContext,
): DashboardMetrics {
  const today = businessDayKey(now, config.businessTimeZone)

  let todaysSales = 0
  let retailerCommissions = 0
  for (const sale of data.sales) {
    retailerCommissions += sale.retailerCommission
    const date = parseISO(sale.date)
    if (date && businessDayKey(date, config.businessTimeZone) === today) todaysSales += sale.amount
  }

  let distributorCommissions = 0
  let referralCommissions = 0
  let companyCommission = 0
  for (const entry of data.ledger) {
    if (entry.type === 'DISTRIBUTOR_REFERRAL') referralCommissions += entry.amount
    else if (entry.type === 'DOWNLINE_SALE') companyCommission += entry.amount
    else distributorCommissions += entry.amount
  }

  let target = 0
  let completed = 0
  let bonus = 0
  for (const { progress } of summaries.values()) {
    target += progress.target
    completed += progress.completed
    bonus += progress.bonus
  }

  return {
    totalDistributors: data.distributors.length,
    totalRetailers: data.retailers.filter((r) => r.status === 'ACTIVE').length,
    todaysSales,
    totalCommissions:
      distributorCommissions + retailerCommissions + referralCommissions + companyCommission,
    distributorCommissions,
    retailerCommissions,
    referralCommissions,
    companyCommission,
    onboarding: {
      target,
      completed,
      achievementPct: target > 0 ? Math.round((completed / target) * 100) : 0,
      remaining: Math.max(0, target - completed),
      bonus,
    },
  }
}
