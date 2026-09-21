import type { LedgerEntry, Referral } from '@/types'
import { apiGet, apiPatch, apiPost } from './apiClient'

export interface CreateReferralInput {
  /** The referrer is worked out by the server from who referred this distributor. */
  referredDistributorId: string
  /** The applicable distributor fee, in cents. The commission is calculated by the server. */
  fee: number
  /** ISO timestamp. Omit for "now". */
  date?: string
}

export interface CommissionService {
  getLedger(): Promise<LedgerEntry[]>
  getReferrals(): Promise<Referral[]>
  createReferral(input: CreateReferralInput): Promise<Referral>
  markReferralPaid(id: string): Promise<Referral>
}

export const commissionService: CommissionService = {
  getLedger: () => apiGet('/commissions/ledger'),
  getReferrals: () => apiGet('/referrals'),
  createReferral: (input) => apiPost('/referrals', input),
  markReferralPaid: (id) =>
    apiPatch(`/referrals/${encodeURIComponent(id)}`, { paymentStatus: 'PAID' }),
}
