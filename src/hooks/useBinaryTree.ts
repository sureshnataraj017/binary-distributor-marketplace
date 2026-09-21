import { useMemo } from 'react'
import { buildForest, collectBranchIds } from '@/domain/treeBuilder'
import type { Retailer } from '@/types'
import { useNetworkStore } from '@/store/networkStore'
import { layoutForest } from '@/utils/treeLayout'
import { useMarketplaceData } from './useMarketplaceData'

/** Builds the binary forest for the current state filter and lays it out for the canvas. */
export function useBinaryTree() {
  const { all, data, summaries, metrics, isScoped, isLoading, error, refetch } =
    useMarketplaceData()
  const collapsedIds = useNetworkStore((s) => s.collapsedIds)

  const forest = useMemo(
    () => (data ? buildForest(data.distributors, { scope: isScoped ? 'SUBSET' : 'FULL' }) : null),
    [data, isScoped],
  )

  const layout = useMemo(
    () => (forest ? layoutForest(forest.roots, collapsedIds) : null),
    [forest, collapsedIds],
  )

  const retailersByDistributor = useMemo(() => {
    const map = new Map<string, Retailer[]>()
    for (const retailer of data?.retailers ?? []) {
      const list = map.get(retailer.distributorId) ?? []
      list.push(retailer)
      map.set(retailer.distributorId, list)
    }
    return map
  }, [data])

  /** The ids "Collapse all" applies to. */
  const branchIds = useMemo(() => (forest ? collectBranchIds(forest.roots) : []), [forest])

  return {
    forest,
    layout,
    distributors: data?.distributors ?? [],
    /** Unfiltered list, so a selected node can always show its full upline. */
    allDistributors: all?.distributors ?? [],
    summaries,
    metrics,
    retailersByDistributor,
    branchIds,
    isLoading,
    error,
    refetch,
  }
}
