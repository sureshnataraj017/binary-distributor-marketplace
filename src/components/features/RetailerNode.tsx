import { Link } from 'react-router-dom'
import type { Retailer } from '@/types'

const DOT: Record<Retailer['status'], string> = {
  ACTIVE: 'bg-series-3',
  DEACTIVATED: 'bg-series-4',
  CANCELLED: 'bg-critical',
}

/** A retailer as a clickable row/chip. Navigates to the retailer details page. */
export function RetailerNode({ retailer }: { retailer: Retailer }) {
  return (
    <Link
      to={`/retailers/${retailer.id}`}
      title={`${retailer.name} · ${retailer.status.toLowerCase()}`}
      className="nodrag nopan flex items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-hover"
    >
      <span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${DOT[retailer.status]}`} />
      <span className="truncate text-brand">{retailer.name}</span>
      <span className="ml-auto shrink-0 text-xs text-ink-2">{retailer.id}</span>
    </Link>
  )
}
