import { ALL_STATES } from '@/config/indiaStates'
import type { Distributor, LedgerEntry, Referral, Retailer, Sale } from '@/types'

export interface MarketplaceData {
  distributors: Distributor[]
  retailers: Retailer[]
  sales: Sale[]
  ledger: LedgerEntry[]
  referrals: Referral[]
}

/** Narrow every dataset to the distributors of one state. Retailers/sales follow their distributor. */
export function scopeByState(data: MarketplaceData, state: string): MarketplaceData {
  if (state === ALL_STATES) return data
  const distributors = data.distributors.filter((d) => d.state === state)
  const ids = new Set(distributors.map((d) => d.id))
  return {
    distributors,
    retailers: data.retailers.filter((r) => ids.has(r.distributorId)),
    sales: data.sales.filter((s) => ids.has(s.distributorId)),
    ledger: data.ledger.filter((e) => ids.has(e.distributorId)),
    referrals: data.referrals.filter((r) => ids.has(r.referringDistributorId)),
  }
}
