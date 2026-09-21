import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { defaultCommissionConfig } from '@/config/commissionConfig'
import { sumMoney } from '@/domain/money'
import { distributorService } from '@/services/distributorService'
import { retailerService } from '@/services/retailerService'
import { salesService } from '@/services/salesService'

/** A single retailer plus its distributor. */
export function useRetailer(id: string | undefined) {
  const retailer = useQuery({
    queryKey: ['retailer', id],
    queryFn: () => retailerService.getById(id!),
    enabled: !!id,
  })
  const distributorId = retailer.data?.distributorId
  const distributor = useQuery({
    queryKey: ['distributor', distributorId],
    queryFn: () => distributorService.getById(distributorId!),
    enabled: !!distributorId,
  })
  return {
    retailer: retailer.data,
    distributor: distributor.data,
    isLoading: retailer.isPending || (!!distributorId && distributor.isPending),
    error: retailer.error ?? distributor.error,
    refetch: () => {
      void retailer.refetch()
      void distributor.refetch()
    },
  }
}

/** Sales of one retailer, plus the totals shown on the retailer details page. */
export function useRetailerSales(retailerId: string | undefined) {
  const query = useQuery({
    queryKey: ['sales', 'retailer', retailerId],
    queryFn: () => salesService.listByRetailer(retailerId!),
    enabled: !!retailerId,
  })
  const sales = query.data
  const totals = useMemo(
    () => ({
      count: sales?.length ?? 0,
      amount: sumMoney((sales ?? []).map((s) => s.amount)),
      retailerCommission: sumMoney((sales ?? []).map((s) => s.retailerCommission)),
      distributorCommission: sumMoney((sales ?? []).map((s) => s.distributorCommission)),
      companyCommission: sumMoney((sales ?? []).map((s) => s.companyCommission)),
      remainder: sumMoney((sales ?? []).map((s) => s.remainder)),
    }),
    [sales],
  )
  return {
    sales: sales ?? [],
    totals,
    percentages: defaultCommissionConfig.sale,
    isLoading: query.isPending && query.fetchStatus !== 'idle',
    error: query.error,
    refetch: () => void query.refetch(),
  }
}
