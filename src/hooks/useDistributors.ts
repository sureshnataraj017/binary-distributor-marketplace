import { useMemo } from 'react'
import { defaultCommissionConfig } from '@/config/commissionConfig'
import { buildDistributorSummaries } from '@/domain/metrics'
import { getUpline, indexById } from '@/domain/treeBuilder'
import { useMarketplaceData } from './useMarketplaceData'

/** State-scoped distributors with their computed summaries (sales, commissions, daily target). */
export function useDistributors() {
  const { data, summaries, isLoading, error, refetch } = useMarketplaceData()
  return { distributors: data?.distributors ?? [], summaries, isLoading, error, refetch }
}

/** Everything the distributor details page needs. Ignores the state filter: a direct link always works. */
export function useDistributorDetails(id: string | undefined) {
  const { all, now, isLoading, error, refetch } = useMarketplaceData()

  const details = useMemo(() => {
    if (!all || !id) return null
    const distributor = all.distributors.find((d) => d.id === id)
    if (!distributor) return null

    const retailers = all.retailers.filter((r) => r.distributorId === id)
    const summary = buildDistributorSummaries(
      {
        distributors: [distributor],
        retailers,
        sales: all.sales.filter((s) => s.distributorId === id),
        ledger: all.ledger.filter((e) => e.entity === id),
        referrals: [],
      },
      { now, config: defaultCommissionConfig },
    ).get(id)!

    const byId = indexById(all.distributors)
    return {
      distributor,
      summary,
      retailers,
      upline: getUpline(id, byId).reverse(),
      children: all.distributors.filter((d) => d.parentId === id),
      referredBy: distributor.referredBy ? (byId.get(distributor.referredBy) ?? null) : null,
      referred: all.distributors.filter((d) => d.referredBy === id),
      referrals: all.referrals.filter((r) => r.referringDistributorId === id),
      recentLedger: all.ledger.filter((e) => e.entity === id).slice(0, 8),
    }
  }, [all, id, now])

  return { details, isLoading, error, refetch, notFound: !isLoading && !error && !details }
}
