import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'
import { defaultCommissionConfig } from '@/config/commissionConfig'
import { calculateCommission, type CommissionBreakdown } from '@/domain/commissionEngine'
import { salesService, type CreateSaleInput } from '@/services/salesService'

/** Records a sale through the API, then refreshes everything derived from sales. */
export function useCreateSale() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateSaleInput) => salesService.create(input),
    // Returning the promise keeps the mutation "pending" until the refreshed data has arrived.
    onSuccess: () =>
      Promise.all([
        // Prefix match: covers ['sales'] and ['sales', 'retailer', id].
        queryClient.invalidateQueries({ queryKey: ['sales'] }),
        queryClient.invalidateQueries({ queryKey: ['ledger'] }),
      ]),
  })
}

/**
 * Live "what will this split into?" for the form. It is only a preview: the server recalculates
 * with the same engine and its response is what gets shown once the sale is recorded.
 */
export function useCommissionPreview(amountCents: number | null): CommissionBreakdown | null {
  return useMemo(
    () =>
      amountCents && amountCents > 0
        ? calculateCommission({ saleAmount: amountCents, ...defaultCommissionConfig.sale })
        : null,
    [amountCents],
  )
}
