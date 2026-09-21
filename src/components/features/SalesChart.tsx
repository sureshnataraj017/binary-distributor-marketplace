import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { DailySales } from '@/domain/metrics'
import { formatCurrency } from '@/utils/currencyFormatter'

const shortDay = (day: string) => {
  const [, month, date] = day.split('-')
  return `${date}/${month}`
}

const compact = (cents: number) => {
  const dollars = cents / 100
  return dollars >= 1000 ? `$${dollars / 1000}k` : `$${dollars}`
}

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: { payload: DailySales }[]
}) {
  const point = payload?.[0]?.payload
  if (!active || !point) return null
  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-md">
      <div className="font-medium">{point.day}</div>
      <div className="text-ink-2">
        {formatCurrency(point.amount)} · {point.count} sale{point.count === 1 ? '' : 's'}
      </div>
    </div>
  )
}

/** Single-series column chart: one colour, no legend (the card title names the series). */
export function SalesChart({ data }: { data: DailySales[] }) {
  return (
    <div>
      <div
        className="h-56"
        role="img"
        aria-label="Daily sales for the last 14 days. A table view is available below."
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--line)" />
            <XAxis
              dataKey="day"
              tickFormatter={shortDay}
              tickLine={false}
              axisLine={{ stroke: 'var(--line-strong)' }}
              tick={{ fill: 'var(--muted)', fontSize: 11 }}
              interval="preserveStartEnd"
            />
            <YAxis
              tickFormatter={compact}
              tickLine={false}
              axisLine={false}
              width={48}
              tick={{ fill: 'var(--muted)', fontSize: 11 }}
            />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--hover)' }} />
            <Bar
              dataKey="amount"
              fill="var(--series-1)"
              radius={[4, 4, 0, 0]}
              maxBarSize={24}
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <details className="mt-2 text-sm">
        <summary className="cursor-pointer text-brand">View as table</summary>
        <table className="mt-2 w-full text-left text-xs">
          <thead className="text-ink-2">
            <tr>
              <th scope="col" className="py-1">
                Day
              </th>
              <th scope="col" className="py-1 text-right">
                Sales
              </th>
              <th scope="col" className="py-1 text-right">
                Orders
              </th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.day} className="border-t border-line tabular-nums">
                <td className="py-1">{d.day}</td>
                <td className="py-1 text-right">{formatCurrency(d.amount)}</td>
                <td className="py-1 text-right">{d.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  )
}
