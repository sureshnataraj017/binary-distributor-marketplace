import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { BinaryTree } from '@/components/features/BinaryTree'
import { NodeDetailsPanel } from '@/components/features/NodeDetailsPanel'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { PageHeader } from '@/components/common/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { indexById } from '@/domain/treeBuilder'
import { useBinaryTree } from '@/hooks/useBinaryTree'
import { useFilterStore } from '@/store/filterStore'
import { useNetworkStore } from '@/store/networkStore'
import { formatCurrency } from '@/utils/currencyFormatter'
import { toFlowGraph } from '@/utils/flowGraph'
import { ALL_STATES } from '@/config/indiaStates'

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2">
      <div className="text-xs text-ink-2">{label}</div>
      <div className="font-semibold tabular-nums">{value}</div>
    </div>
  )
}

export default function Network() {
  const tree = useBinaryTree()
  const selectedState = useFilterStore((s) => s.selectedState)
  const { selectedId, select, expandAll, collapseAll, collapsedIds } = useNetworkStore()

  const graph = useMemo(
    () =>
      tree.layout
        ? toFlowGraph({
            items: tree.layout.items,
            edges: tree.layout.edges,
            distributors: tree.distributors,
            summaries: tree.summaries,
            retailersByDistributor: tree.retailersByDistributor,
            metrics: tree.metrics,
          })
        : null,
    [tree.layout, tree.distributors, tree.summaries, tree.retailersByDistributor, tree.metrics],
  )

  const byId = useMemo(() => indexById(tree.allDistributors), [tree.allDistributors])
  const selected = selectedId ? (tree.distributors.find((d) => d.id === selectedId) ?? null) : null
  const metrics = tree.metrics
  const isEmpty = !tree.isLoading && !tree.error && tree.distributors.length === 0

  return (
    <>
      <PageHeader
        title="Distributor network"
        description={
          selectedState === ALL_STATES
            ? 'Binary placement tree of every distributor. Hover a node for its retailers, click to select.'
            : `Distributors in ${selectedState}. Parents outside the state are omitted from this view.`
        }
        actions={
          <>
            <Button onClick={expandAll} disabled={collapsedIds.size === 0}>
              Expand all
            </Button>
            <Button
              onClick={() => collapseAll(tree.branchIds)}
              disabled={tree.branchIds.length === 0}
            >
              Collapse all
            </Button>
          </>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Distributors" value={metrics?.totalDistributors ?? '–'} />
        <Stat label="Retailers" value={metrics?.totalRetailers ?? '–'} />
        <Stat
          label="Total sales"
          value={
            graph && tree.summaries
              ? formatCurrency([...tree.summaries.values()].reduce((n, s) => n + s.totalSales, 0))
              : '–'
          }
        />
        <Stat
          label="Total commissions"
          value={metrics ? formatCurrency(metrics.totalCommissions) : '–'}
        />
      </div>

      {tree.forest && tree.forest.issues.length > 0 && (
        <div
          role="status"
          className="mb-4 rounded-lg border border-line-strong bg-warn-soft px-3 py-2 text-sm text-warn"
        >
          <strong>{tree.forest.issues.length} data issue(s) found in the hierarchy.</strong>{' '}
          {tree.forest.issues
            .slice(0, 3)
            .map((issue) => issue.message)
            .join(' · ')}
        </div>
      )}

      <Card className="relative h-[min(70vh,720px)] min-h-[420px] overflow-hidden">
        {tree.isLoading && (
          <div className="p-6" aria-busy="true" aria-label="Loading network">
            <Skeleton className="mx-auto h-24 w-64" />
            <div className="mt-10 flex justify-center gap-10">
              <Skeleton className="h-24 w-64" />
              <Skeleton className="h-24 w-64" />
            </div>
          </div>
        )}
        {tree.error && <ErrorState error={tree.error} onRetry={tree.refetch} />}
        {isEmpty && (
          <EmptyState
            title={
              tree.allDistributors.length === 0
                ? 'The network is empty'
                : 'No distributors here yet'
            }
            description={
              tree.allDistributors.length === 0
                ? 'Add your first distributor and the tree will start to grow.'
                : `There are no distributors in ${selectedState}. Pick another state to see its network.`
            }
            action={
              <Link
                to="/distributors"
                className="rounded-lg bg-brand-solid px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
              >
                Add a distributor
              </Link>
            }
          />
        )}

        {graph && !isEmpty && (
          <BinaryTree
            nodes={graph.nodes}
            edges={graph.edges}
            fitKey={`${selectedState}:${graph.nodes.length}`}
          />
        )}

        {selected && (
          <div className="pointer-events-none absolute inset-y-3 right-3 z-10 flex w-[min(20rem,calc(100%-1.5rem))] items-start">
            <NodeDetailsPanel
              distributor={selected}
              summary={tree.summaries?.get(selected.id)}
              retailers={tree.retailersByDistributor.get(selected.id) ?? []}
              byId={byId}
              onClose={() => select(null)}
            />
          </div>
        )}
      </Card>

      <p className="mt-2 text-xs text-ink-2">
        Drag to pan · scroll or pinch to zoom · "−/+" under a node collapses or expands its
        downline. L / R marks the leg.
      </p>
    </>
  )
}
