import type { CommissionConfig } from '@/config/commissionConfig'
import type { Distributor, LedgerEntry, Referral, Retailer, Sale } from '@/types'
import { businessDayKey, parseISO } from './dateUtils'
import { assessOnboardings } from './onboardingRules'

export interface LedgerInput {
  distributors: readonly Distributor[]
  retailers: readonly Retailer[]
  sales: readonly Sale[]
  referrals: readonly Referral[]
  now: Date
  config: CommissionConfig
}

/**
 * Turn raw business events into one normalized commission ledger.
 * Dashboard KPIs, the ledger page and distributor pages all read from this, so they always reconcile.
 */
export function buildLedger({
  distributors,
  retailers,
  sales,
  referrals,
  now,
  config,
}: LedgerInput): LedgerEntry[] {
  const entries: LedgerEntry[] = []
  const zone = config.businessTimeZone

  // Onboarding bonus: one entry per qualifying retailer (duplicates/cancelled/invalid never earn).
  for (const distributor of distributors) {
    const own = retailers.filter((r) => r.distributorId === distributor.id)
    const qualifying = assessOnboardings(own, distributor, { now, config })
      .filter((a) => a.qualifies)
      .map((a) => a.retailer)
      .sort((a, b) => a.onboardedAt.localeCompare(b.onboardedAt))

    const paidPerDay = new Map<string, number>()
    for (const retailer of qualifying) {
      const onboardedAt = parseISO(retailer.onboardedAt)
      if (!onboardedAt) continue
      const day = businessDayKey(onboardedAt, zone)
      const paid = paidPerDay.get(day) ?? 0
      if (config.onboarding.capBonusAtTarget && paid >= distributor.dailyTarget) continue
      paidPerDay.set(day, paid + 1)
      entries.push({
        id: `LED-ONB-${retailer.id}`,
        date: retailer.onboardedAt,
        entity: distributor.id,
        distributorId: distributor.id,
        type: 'ONBOARDING',
        reference: retailer.id,
        amount: config.onboarding.bonusPerRetailer,
        status: 'EARNED',
      })
    }
  }

  for (const sale of sales) {
    if (sale.distributorCommission > 0) {
      entries.push({
        id: `LED-SALE-${sale.id}`,
        date: sale.date,
        entity: sale.distributorId,
        distributorId: sale.distributorId,
        type: 'RETAILER_SALE',
        reference: sale.id,
        amount: sale.distributorCommission,
        status: 'EARNED',
      })
    }
    if (sale.companyCommission > 0) {
      entries.push({
        id: `LED-DL-${sale.id}`,
        date: sale.date,
        entity: 'Company',
        distributorId: sale.distributorId,
        type: 'DOWNLINE_SALE',
        reference: sale.id,
        amount: sale.companyCommission,
        status: 'EARNED',
      })
    }
  }

  for (const referral of referrals) {
    entries.push({
      id: `LED-REF-${referral.id}`,
      date: referral.date,
      entity: referral.referringDistributorId,
      distributorId: referral.referringDistributorId,
      type: 'DISTRIBUTOR_REFERRAL',
      reference: referral.referredDistributorId,
      amount: referral.commission,
      status: referral.paymentStatus === 'PAID' ? 'EARNED' : 'PENDING',
    })
  }

  return entries.sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id))
}
