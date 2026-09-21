import type { DashboardMetrics } from '@/domain/metrics'
import { formatCurrency } from '@/utils/currencyFormatter'

/** Part-to-whole of the four commission streams: horizontal bars, colour fixed per stream. */
export function CommissionMix({ metrics }: { metrics: DashboardMetrics }) {
  const rows = [
    { label: 'Distributor', value: metrics.distributorCommissions, color: 'bg-series-1' },
    { label: 'Retailer', value: metrics.retailerCommissions, color: 'bg-series-2' },
    { label: 'Referral', value: metrics.referralCommissions, color: 'bg-series-3' },
    { label: 'Company downline', value: metrics.companyCommission, color: 'bg-series-4' },
  ]
  const max = Math.max(...rows.map((r) => r.value), 1)

  return (
    <ul className="space-y-3">
      {rows.map((row) => {
        const share =
          metrics.totalCommissions > 0 ? (row.value / metrics.totalCommissions) * 100 : 0
        return (
          <li key={row.label}>
            <div className="mb-1 flex items-baseline justify-between text-sm">
              <span className="flex items-center gap-2 text-ink-2">
                <span aria-hidden="true" className={`size-2 rounded-full ${row.color}`} />
                {row.label}
              </span>
              <span className="tabular-nums">
                <span className="font-medium">{formatCurrency(row.value)}</span>
                <span className="ml-2 text-xs text-ink-2">{share.toFixed(1)}%</span>
              </span>
            </div>
            <div className="h-2 rounded-full bg-hover" aria-hidden="true">
              <div
                className={`h-2 rounded-full ${row.color}`}
                style={{ width: `${(row.value / max) * 100}%` }}
              />
            </div>
          </li>
        )
      })}
    </ul>
  )
}
