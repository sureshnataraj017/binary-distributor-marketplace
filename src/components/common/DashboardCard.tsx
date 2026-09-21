import type { ReactNode } from 'react'
import { Card } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'

interface DashboardCardProps {
  label: string
  value: ReactNode
  hint?: ReactNode
  /** Colored key beside the label. Identity only, never the value text. */
  accent?: 'series-1' | 'series-2' | 'series-3' | 'series-4'
  loading?: boolean
  children?: ReactNode
}

const ACCENTS = {
  'series-1': 'bg-series-1',
  'series-2': 'bg-series-2',
  'series-3': 'bg-series-3',
  'series-4': 'bg-series-4',
}

export function DashboardCard({
  label,
  value,
  hint,
  accent,
  loading,
  children,
}: DashboardCardProps) {
  return (
    <Card className="flex flex-col gap-1 p-4">
      <div className="flex items-center gap-2 text-sm text-ink-2">
        {accent && <span aria-hidden="true" className={`size-2 rounded-full ${ACCENTS[accent]}`} />}
        {label}
      </div>
      {loading ? (
        <Skeleton className="mt-1 h-8 w-28" />
      ) : (
        <div className="text-2xl font-semibold tracking-tight">{value}</div>
      )}
      {loading ? (
        <Skeleton className="mt-1 h-4 w-36" />
      ) : (
        hint && <div className="text-xs text-ink-2">{hint}</div>
      )}
      {!loading && children}
    </Card>
  )
}
