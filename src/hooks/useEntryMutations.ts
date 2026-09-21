import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query'
import { useMemo } from 'react'
import { defaultCommissionConfig } from '@/config/commissionConfig'
import { calculateReferralCommission } from '@/domain/commissionEngine'
import { commissionService, type CreateReferralInput } from '@/services/commissionService'
import { distributorService, type CreateDistributorInput } from '@/services/distributorService'
import { retailerService, type CreateRetailerInput } from '@/services/retailerService'
import type { RetailerStatus } from '@/types'

/**
 * A write to the API, followed by a refresh of the cached data it changed. Returning the promise from
 * `onSuccess` keeps the mutation "pending" until the refreshed data has arrived, so screens never flash stale.
 * Key prefixes match: ['retailer'] also refreshes ['retailer', 'RET-1001'].
 */
function useApiMutation<Input, Output>(
  mutationFn: (input: Input) => Promise<Output>,
  refresh: readonly QueryKey[],
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: () =>
      Promise.all(refresh.map((queryKey) => queryClient.invalidateQueries({ queryKey }))),
  })
}

export const useCreateDistributor = () =>
  useApiMutation(
    (input: CreateDistributorInput) => distributorService.create(input),
    [['distributors'], ['distributor']],
  )

/** A new retailer changes its distributor's retailer list and earns an onboarding bonus in the ledger. */
export const useCreateRetailer = () =>
  useApiMutation(
    (input: CreateRetailerInput) => retailerService.create(input),
    [['retailers'], ['retailer'], ['distributors'], ['distributor'], ['ledger']],
  )

/** Cancelled and deactivated retailers stop earning bonuses and sales, so the ledger changes too. */
export const useSetRetailerStatus = () =>
  useApiMutation(
    ({ id, status }: { id: string; status: RetailerStatus }) =>
      retailerService.setStatus(id, status),
    [['retailers'], ['retailer'], ['ledger']],
  )

export const useCreateReferral = () =>
  useApiMutation(
    (input: CreateReferralInput) => commissionService.createReferral(input),
    [['referrals'], ['ledger']],
  )

export const usePayReferral = () =>
  useApiMutation(
    (id: string) => commissionService.markReferralPaid(id),
    [['referrals'], ['ledger']],
  )

/** Live commission preview for the referral form. The server recalculates and its figure is the one stored. */
export function useReferralPreview(feeCents: number | null): number | null {
  return useMemo(
    () =>
      feeCents && feeCents > 0
        ? calculateReferralCommission(feeCents, defaultCommissionConfig.referralPercentage)
        : null,
    [feeCents],
  )
}
