import type { LedgerEntry, Referral } from '@/types'
import { apiGet } from './apiClient'

export interface CommissionService {
  getLedger(): Promise<LedgerEntry[]>
  getReferrals(): Promise<Referral[]>
}

export const commissionService: CommissionService = {
  getLedger: () => apiGet('/commissions/ledger'),
  getReferrals: () => apiGet('/referrals'),
}
