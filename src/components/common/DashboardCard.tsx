import type { ComponentType, ReactNode } from 'react'
import { Card } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'

interface DashboardCardProps {
  label: string
  value: ReactNode
  hint?: ReactNode
  /** Colored key beside the label. Identity only, never the value text. */
  accent?: 'series-1' | 'series-2' | 'series-3' | 'series-4'
  icon?: ComponentType<{ className?: string }>
  loading?: boolean
  children?: ReactNode
}

const ACCENTS = {
  'series-1': 'bg-series-1',
  'series-2': 'bg-series-2',
  'series-3': 'bg-series-3',
  'series-4': 'bg-series-4',
}

const ICON_CHIPS = {
  'series-1': 'bg-series-1/12 text-series-1',
  'series-2': 'bg-series-2/12 text-series-2',
  'series-3': 'bg-series-3/12 text-series-3',
  'series-4': 'bg-series-4/12 text-series-4',
}

export function DashboardCard({
  label,
  value,
  hint,
  accent,
  icon: Icon,
  loading,
  children,
}: DashboardCardProps) {
  return (
    <Card className="group relative flex flex-col gap-1 overflow-hidden p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      {Icon && (
        <span
          aria-hidden="true"
          className={`absolute top-4 right-4 flex size-9 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-105 ${accent ? ICON_CHIPS[accent] : 'bg-brand-soft text-brand'}`}
        >
          <Icon className="size-4.5" />
        </span>
      )}
      <div className="flex items-center gap-2 pr-11 text-sm text-ink-2">
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
