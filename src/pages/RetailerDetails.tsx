import { Plus } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { RecordSaleForm } from '@/components/features/RecordSaleForm'
import { RetailerStatusControl } from '@/components/features/RetailerStatusControl'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { PageHeader } from '@/components/common/PageHeader'
import { StatusBadge } from '@/components/common/StatusBadge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { useRetailer, useRetailerSales } from '@/hooks/useRetailers'
import { ApiError } from '@/services/apiClient'
import { formatCurrency } from '@/utils/currencyFormatter'
import { formatDate, formatShortDate } from '@/utils/dateFormatter'

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-ink-2">{label}</dt>
      <dd className="mt-0.5 font-medium">{children}</dd>
    </div>
  )
}

export default function RetailerDetails() {
  const { id } = useParams()
  const { retailer, distributor, isLoading, error, refetch } = useRetailer(id)
  const { sales, totals } = useRetailerSales(id)
  const [formOpen, setFormOpen] = useState(false)

  if (error instanceof ApiError && error.status === 404) {
    return (
      <Card>
        <EmptyState
          title="Retailer not found"
          description={`There is no retailer with ID ${id}.`}
          action={
            <Link to="/distributors/network" className="text-brand hover:underline">
              Back to network
            </Link>
          }
        />
      </Card>
    )
  }
  if (error)
    return (
      <Card>
        <ErrorState error={error} onRetry={refetch} />
      </Card>
    )

  const recent = [...sales].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5)
  const canSell = retailer?.status === 'ACTIVE'

  return (
    <>
      <PageHeader
        crumbs={[
          { label: 'Network', to: '/distributors/network' },
          ...(distributor
            ? [{ label: distributor.name, to: `/distributors/${distributor.id}` }]
            : []),
          { label: retailer?.name ?? String(id) },
        ]}
        title={
          retailer ? (
            <span className="flex items-center gap-3">
              {retailer.name} <StatusBadge status={retailer.status} />
            </span>
          ) : (
            <Skeleton className="h-8 w-56" />
          )
        }
        actions={
          <>
            <Button
              variant="primary"
              disabled={!canSell || formOpen}
              onClick={() => setFormOpen(true)}
            >
              <Plus className="size-4" />
              Record a sale
            </Button>
            <Link
              to={`/retailers/${id}/sales`}
              className="rounded-lg border border-line-strong bg-surface px-3 py-1.5 text-sm font-medium hover:bg-hover"
            >
              View all sales
            </Link>
          </>
        }
      />

      {retailer && retailer.status !== 'CANCELLED' && (
        <div className="mb-4">
          <RetailerStatusControl retailer={retailer} />
        </div>
      )}
      {retailer && !canSell && (
        <p className="mb-4 rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn">
          Sales can't be recorded for a {retailer.status.toLowerCase()} retailer.
        </p>
      )}
      {retailer && canSell && formOpen && (
        <RecordSaleForm retailer={retailer} onClose={() => setFormOpen(false)} />
      )}

      <Card className="p-5">
        {isLoading || !retailer ? (
          <Skeleton className="h-32 w-full" />
        ) : (
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-4">
            <Fact label="Retailer ID">{retailer.id}</Fact>
            <Fact label="Distributor">
              {distributor ? (
                <Link to={`/distributors/${distributor.id}`} className="text-brand hover:underline">
                  {distributor.name} ({distributor.id})
                </Link>
              ) : (
                '…'
              )}
            </Fact>
            <Fact label="State">{retailer.state}</Fact>
            <Fact label="City">{retailer.city}</Fact>
            <Fact label="Onboarded">{formatDate(retailer.onboardedAt)}</Fact>
            <Fact label="Status">
              <StatusBadge status={retailer.status} />
            </Fact>
            <Fact label="Total sales">{formatCurrency(totals.amount)}</Fact>
            <Fact label="Retailer commission">{formatCurrency(totals.retailerCommission)}</Fact>
            <Fact label="Transactions">{totals.count}</Fact>
            <Fact label="Distributor earned">{formatCurrency(totals.distributorCommission)}</Fact>
            <Fact label="Company earned">{formatCurrency(totals.companyCommission)}</Fact>
            <Fact label="Unallocated remainder">{formatCurrency(totals.remainder)}</Fact>
          </dl>
        )}
      </Card>

      <Card className="mt-4 p-5">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-semibold">Recent sales</h2>
          <Link to={`/retailers/${id}/sales`} className="text-sm text-brand hover:underline">
            See all {totals.count}
          </Link>
        </div>
        {recent.length === 0 ? (
          <p className="py-3 text-sm text-ink-2">No sales recorded for this retailer.</p>
        ) : (
          <ul className="divide-y divide-line text-sm">
            {recent.map((sale) => (
              <li key={sale.id} className="flex items-center justify-between gap-3 py-2">
                <span>
                  <span className="font-medium">{sale.id}</span>
                  <span className="text-ink-2">
                    {' '}
                    · {sale.product} × {sale.quantity} · {formatShortDate(sale.date)}
                  </span>
                </span>
                <span className="font-medium tabular-nums">{formatCurrency(sale.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  )
}
