import { useQuery } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'
import { ALL_STATES } from '@/config/indiaStates'
import { defaultCommissionConfig } from '@/config/commissionConfig'
import { buildDistributorSummaries, computeDashboardMetrics } from '@/domain/metrics'
import { scopeByState, type MarketplaceData } from '@/domain/scope'
import { commissionService } from '@/services/commissionService'
import { distributorService } from '@/services/distributorService'
import { retailerService } from '@/services/retailerService'
import { salesService } from '@/services/salesService'
import { useFilterStore } from '@/store/filterStore'
import { useNow } from './useNow'

/**
 * Loads every dataset once (cached by TanStack Query) and derives the state-scoped view.
 * All list/KPI/tree hooks build on this so the numbers can never disagree between screens.
 */
export function useMarketplaceData() {
  const selectedState = useFilterStore((s) => s.selectedState)
  const now = useNow()

  const distributors = useQuery({ queryKey: ['distributors'], queryFn: distributorService.list })
  const retailers = useQuery({ queryKey: ['retailers'], queryFn: retailerService.list })
  const sales = useQuery({ queryKey: ['sales'], queryFn: salesService.list })
  const ledger = useQuery({ queryKey: ['ledger'], queryFn: commissionService.getLedger })
  const referrals = useQuery({ queryKey: ['referrals'], queryFn: commissionService.getReferrals })
  const queries = [distributors, retailers, sales, ledger, referrals]

  const all = useMemo<MarketplaceData | null>(() => {
    if (!distributors.data || !retailers.data || !sales.data || !ledger.data || !referrals.data)
      return null
    return {
      distributors: distributors.data,
      retailers: retailers.data,
      sales: sales.data,
      ledger: ledger.data,
      referrals: referrals.data,
    }
  }, [distributors.data, retailers.data, sales.data, ledger.data, referrals.data])

  const scoped = useMemo(
    () => (all ? scopeByState(all, selectedState) : null),
    [all, selectedState],
  )

  const context = useMemo(() => ({ now, config: defaultCommissionConfig }), [now])

  const summaries = useMemo(
    () => (scoped ? buildDistributorSummaries(scoped, context) : null),
    [scoped, context],
  )

  const metrics = useMemo(
    () => (scoped && summaries ? computeDashboardMetrics(scoped, summaries, context) : null),
    [scoped, summaries, context],
  )

  const refetch = useCallback(() => {
    queries.forEach((q) => void q.refetch())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [distributors, retailers, sales, ledger, referrals])

  return {
    all,
    data: scoped,
    summaries,
    metrics,
    now,
    selectedState,
    isScoped: selectedState !== ALL_STATES,
    isLoading: queries.some((q) => q.isPending),
    error: queries.find((q) => q.error)?.error ?? null,
    refetch,
  }
}
