import { useMemo } from 'react'
import { useMarketplaceData } from './useMarketplaceData'

/** State-scoped ledger and referrals, plus the lookups needed to link entries to their sources. */
export function useCommissions() {
  const { all, data, metrics, isLoading, error, refetch } = useMarketplaceData()

  const retailerBySale = useMemo(
    () => new Map((all?.sales ?? []).map((s) => [s.id, s.retailerId])),
    [all],
  )
  const nameById = useMemo(
    () => new Map((all?.distributors ?? []).map((d) => [d.id, d.name])),
    [all],
  )

  return {
    ledger: data?.ledger ?? [],
    referrals: data?.referrals ?? [],
    metrics,
    retailerBySale,
    nameById,
    isLoading,
    error,
    refetch,
  }
}
