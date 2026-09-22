import { Handle, Position, type Node, type NodeProps } from '@xyflow/react'
import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { DistributorSummary } from '@/domain/metrics'
import { useNetworkStore } from '@/store/networkStore'
import type { Distributor, Position as Side, Retailer } from '@/types'
import { formatCurrency } from '@/utils/currencyFormatter'
import { NODE_WIDTH } from '@/utils/treeLayout'
import { RetailerNode } from './RetailerNode'
import { Tooltip } from './Tooltip'

export interface DistributorNodeData extends Record<string, unknown> {
  distributor: Distributor
  summary: DistributorSummary | undefined
  retailers: Retailer[]
  side: Side | null
  hiddenCount: number
  hasChildren: boolean
}
export type DistributorFlowNode = Node<DistributorNodeData, 'distributor'>

const MAX_POPUP_RETAILERS = 6

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-ink-2">{label}</dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  )
}

function DistributorPopup({
  distributor,
  summary,
  retailers,
}: Pick<DistributorNodeData, 'distributor' | 'summary' | 'retailers'>) {
  const shown = retailers.slice(0, MAX_POPUP_RETAILERS)
  const extra = retailers.length - shown.length
  return (
    <div>
      <div className="font-semibold">{distributor.name}</div>
      <div className="mb-2 text-xs text-ink-2">
        {distributor.id} · {distributor.city}, {distributor.state}
      </div>
      {summary && (
        <dl className="mb-3 grid grid-cols-2 gap-x-4 gap-y-2">
          <Metric label="Total sales" value={formatCurrency(summary.totalSales)} />
          <Metric label="Commission" value={formatCurrency(summary.distributorCommission)} />
          <Metric
            label="Today's target"
            value={`${summary.progress.completed} / ${summary.progress.target}`}
          />
          <Metric label="Today's bonus" value={formatCurrency(summary.progress.bonus)} />
        </dl>
      )}
      <div className="mb-1 text-xs font-medium uppercase tracking-wide text-ink-2">
        Retailers ({retailers.length})
      </div>
      {retailers.length === 0 ? (
        <p className="py-1 text-xs text-ink-2">No retailers onboarded yet.</p>
      ) : (
        <ul className="-mx-2">
          {shown.map((retailer) => (
            <li key={retailer.id}>
              <RetailerNode retailer={retailer} />
            </li>
          ))}
        </ul>
      )}
      <Link
        to={`/distributors/${distributor.id}`}
        className="mt-2 inline-flex items-center gap-0.5 text-xs text-brand hover:underline"
      >
        {extra > 0 ? `+${extra} more · ` : ''}Open distributor details
        <ArrowRight aria-hidden="true" className="size-3" />
      </Link>
    </div>
  )
}

export function DistributorNode({ data }: NodeProps<DistributorFlowNode>) {
  const { distributor, summary, retailers, side, hiddenCount, hasChildren } = data
  const selected = useNetworkStore((s) => s.selectedId === distributor.id)
  const select = useNetworkStore((s) => s.select)
  const toggleCollapsed = useNetworkStore((s) => s.toggleCollapsed)
  const collapsed = hiddenCount > 0
  const progress = summary?.progress

  return (
    <div className="relative" style={{ width: NODE_WIDTH }}>
      <Handle
        type="target"
        position={Position.Top}
        className="!size-1 !min-h-0 !min-w-0 !border-0 !opacity-0"
      />
      <Tooltip
        content={
          <DistributorPopup distributor={distributor} summary={summary} retailers={retailers} />
        }
      >
        <div
          role="button"
          tabIndex={0}
          aria-pressed={selected}
          aria-label={`${distributor.name}, ${distributor.id}, ${retailers.length} retailers`}
          onClick={() => select(selected ? null : distributor.id)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              select(selected ? null : distributor.id)
            }
          }}
          className={`nodrag cursor-pointer rounded-xl border bg-surface p-3 text-left shadow-sm transition ${
            selected ? 'border-brand ring-2 ring-brand' : 'border-line hover:border-line-strong'
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate font-semibold">{distributor.name}</div>
              <div className="truncate text-xs text-ink-2">
                {distributor.id} · {distributor.city}
              </div>
            </div>
            {side && (
              <span
                className="shrink-0 rounded bg-hover px-1.5 py-0.5 text-[10px] font-semibold text-ink-2"
                title={`${side} leg`}
              >
                {side === 'LEFT' ? 'L' : 'R'}
              </span>
            )}
          </div>
          <div className="mt-0.5 truncate text-xs text-ink-2">{distributor.state}</div>

          <dl className="mt-2 grid grid-cols-3 gap-1 border-t border-line pt-2 text-xs">
            <div>
              <dt className="text-ink-2">Retailers</dt>
              <dd className="font-semibold tabular-nums">{summary?.retailerCount ?? '–'}</dd>
            </div>
            <div>
              <dt className="text-ink-2">Sales</dt>
              <dd className="font-semibold tabular-nums">
                {summary ? formatCurrency(summary.totalSales) : '–'}
              </dd>
            </div>
            <div>
              <dt className="text-ink-2">Today</dt>
              <dd className="font-semibold tabular-nums">
                {progress ? `${progress.completed}/${progress.target}` : '–'}
              </dd>
            </div>
          </dl>
        </div>
      </Tooltip>

      {hasChildren && (
        <button
          type="button"
          onClick={() => toggleCollapsed(distributor.id)}
          aria-expanded={!collapsed}
          aria-label={
            collapsed
              ? `Expand ${distributor.name}'s downline (${hiddenCount} hidden)`
              : `Collapse ${distributor.name}'s downline`
          }
          className="nodrag nopan absolute -bottom-3 left-1/2 z-10 min-w-6 -translate-x-1/2 rounded-full border border-line-strong bg-surface px-1.5 text-xs font-medium text-ink-2 hover:bg-hover"
        >
          {collapsed ? `+${hiddenCount}` : '−'}
        </button>
      )}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!size-1 !min-h-0 !min-w-0 !border-0 !opacity-0"
      />
    </div>
  )
}
