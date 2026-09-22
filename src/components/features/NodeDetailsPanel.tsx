import { ChevronRight, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import type { DistributorSummary } from '@/domain/metrics'
import { traceSaleHierarchy } from '@/domain/treeBuilder'
import type { Distributor, Retailer } from '@/types'
import { formatCurrency } from '@/utils/currencyFormatter'
import { formatDate } from '@/utils/dateFormatter'
import { RetailerNode } from './RetailerNode'

interface Props {
  distributor: Distributor
  summary: DistributorSummary | undefined
  retailers: Retailer[]
  byId: ReadonlyMap<string, Distributor>
  onClose: () => void
}

/** Detail panel for the node selected in the tree, including the hierarchy above it. */
export function NodeDetailsPanel({ distributor, summary, retailers, byId, onClose }: Props) {
  const path = traceSaleHierarchy(distributor.id, byId)
  return (
    <Card
      className="pointer-events-auto max-h-full w-full overflow-y-auto p-4 shadow-lg"
      role="complementary"
      aria-label={`${distributor.name} details`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="font-semibold">{distributor.name}</h2>
          <p className="text-xs text-ink-2">
            {distributor.id} · {distributor.city}, {distributor.state}
          </p>
        </div>
        <Button variant="ghost" onClick={onClose} aria-label="Close panel" className="!px-2">
          <X className="size-4" />
        </Button>
      </div>

      <p className="mt-2 text-xs text-ink-2">Joined {formatDate(distributor.joinedAt)}</p>

      <div className="mt-3">
        <div className="text-xs font-medium uppercase tracking-wide text-ink-2">Hierarchy</div>
        <ol className="mt-1 flex flex-wrap items-center gap-1 text-xs">
          <li className="text-ink-2">Company</li>
          {path.map((node) => (
            <li key={node.id} className="flex items-center gap-1">
              <ChevronRight aria-hidden="true" className="size-3 text-muted" />
              {node.id === distributor.id ? (
                <span className="font-semibold">{node.name}</span>
              ) : (
                <Link to={`/distributors/${node.id}`} className="text-brand hover:underline">
                  {node.name}
                </Link>
              )}
            </li>
          ))}
        </ol>
      </div>

      {summary && (
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <div>
            <dt className="text-xs text-ink-2">Total sales</dt>
            <dd className="font-medium tabular-nums">{formatCurrency(summary.totalSales)}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-2">Commission</dt>
            <dd className="font-medium tabular-nums">
              {formatCurrency(summary.distributorCommission)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-ink-2">Referral</dt>
            <dd className="font-medium tabular-nums">
              {formatCurrency(summary.referralCommission)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-ink-2">Today</dt>
            <dd className="font-medium tabular-nums">
              {summary.progress.completed} / {summary.progress.target} (
              {summary.progress.achievementPct}%)
            </dd>
          </div>
        </dl>
      )}

      <div className="mt-3">
        <div className="text-xs font-medium uppercase tracking-wide text-ink-2">
          Retailers ({retailers.length})
        </div>
        <ul className="-mx-2 mt-1 max-h-40 overflow-y-auto">
          {retailers.map((retailer) => (
            <li key={retailer.id}>
              <RetailerNode retailer={retailer} />
            </li>
          ))}
        </ul>
      </div>

      <Link
        to={`/distributors/${distributor.id}`}
        className="mt-3 block rounded-lg bg-linear-to-r from-brand-solid to-brand-2 px-3 py-2 text-center text-sm font-medium text-white shadow-sm hover:shadow-md hover:brightness-105"
      >
        View full details
      </Link>
    </Card>
  )
}
