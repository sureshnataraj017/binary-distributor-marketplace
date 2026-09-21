import { Link, useParams } from 'react-router-dom'
import { DataTable, type Column } from '@/components/common/DataTable'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { PageHeader } from '@/components/common/PageHeader'
import { ProgressRing } from '@/components/common/ProgressRing'
import { StatusBadge } from '@/components/common/StatusBadge'
import { Card } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { useDistributorDetails } from '@/hooks/useDistributors'
import type { LedgerEntry, Retailer } from '@/types'
import { formatCurrency } from '@/utils/currencyFormatter'
import { formatDate, formatShortDate, humanize } from '@/utils/dateFormatter'

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-ink-2">{label}</dt>
      <dd className="mt-0.5 font-medium">{children}</dd>
    </div>
  )
}

const retailerColumns: Column<Retailer>[] = [
  { key: 'id', header: 'ID', cell: (r) => r.id, sortValue: (r) => r.id },
  {
    key: 'name',
    header: 'Retailer',
    cell: (r) => (
      <Link to={`/retailers/${r.id}`} className="text-brand hover:underline">
        {r.name}
      </Link>
    ),
    sortValue: (r) => r.name,
  },
  { key: 'city', header: 'City', cell: (r) => r.city, sortValue: (r) => r.city },
  {
    key: 'onboarded',
    header: 'Onboarded',
    cell: (r) => formatDate(r.onboardedAt),
    sortValue: (r) => r.onboardedAt,
  },
  {
    key: 'status',
    header: 'Status',
    cell: (r) => <StatusBadge status={r.status} />,
    sortValue: (r) => r.status,
  },
]

const ledgerColumns: Column<LedgerEntry>[] = [
  { key: 'date', header: 'Date', cell: (e) => formatShortDate(e.date) },
  { key: 'type', header: 'Type', cell: (e) => humanize(e.type) },
  { key: 'ref', header: 'Reference', cell: (e) => e.reference },
  { key: 'amount', header: 'Amount', align: 'right', cell: (e) => formatCurrency(e.amount) },
  { key: 'status', header: 'Status', cell: (e) => <StatusBadge status={e.status} /> },
]

export default function DistributorDetails() {
  const { id } = useParams()
  const { details, isLoading, error, refetch, notFound } = useDistributorDetails(id)

  if (error)
    return (
      <Card>
        <ErrorState error={error} onRetry={refetch} />
      </Card>
    )
  if (notFound) {
    return (
      <Card>
        <EmptyState
          title="Distributor not found"
          description={`There is no distributor with ID ${id}.`}
          action={
            <Link to="/distributors/network" className="text-brand hover:underline">
              Back to network
            </Link>
          }
        />
      </Card>
    )
  }

  if (isLoading || !details) {
    return (
      <div className="space-y-4" aria-busy="true">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-44 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  const { distributor, summary, upline, children, referredBy, referred } = details
  const progress = summary.progress

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Network', to: '/distributors/network' }, { label: distributor.name }]}
        title={`${distributor.name} · ${distributor.id}`}
        description={
          <span>
            Company
            {upline.map((node) => (
              <span key={node.id}>
                {' '}
                ›{' '}
                <Link to={`/distributors/${node.id}`} className="text-brand hover:underline">
                  {node.name}
                </Link>
              </span>
            ))}{' '}
            › <strong className="text-ink">{distributor.name}</strong>
          </span>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-3">
            <Fact label="Distributor ID">{distributor.id}</Fact>
            <Fact label="State">{distributor.state}</Fact>
            <Fact label="City">{distributor.city}</Fact>
            <Fact label="Joined">{formatDate(distributor.joinedAt)}</Fact>
            <Fact label="Placement">
              {distributor.position ? `${humanize(distributor.position)} leg` : 'Top level'}
            </Fact>
            <Fact label="Referred by">
              {referredBy ? (
                <Link to={`/distributors/${referredBy.id}`} className="text-brand hover:underline">
                  {referredBy.name}
                </Link>
              ) : (
                '—'
              )}
            </Fact>
            <Fact label="Retailers">{summary.retailerCount}</Fact>
            <Fact label="Total sales">{formatCurrency(summary.totalSales)}</Fact>
            <Fact label="Direct downline">
              {children.length === 0 ? 'None' : children.map((c) => c.name).join(', ')}
            </Fact>
            <Fact label="Distributor commission">
              {formatCurrency(summary.distributorCommission)}
            </Fact>
            <Fact label="Referral commission">{formatCurrency(summary.referralCommission)}</Fact>
            <Fact label="Referred distributors">{referred.length}</Fact>
          </dl>
        </Card>

        <Card className="flex items-center gap-4 p-5">
          <ProgressRing
            percent={progress.achievementPct}
            size={88}
            label="Daily target achievement"
          />
          <div className="text-sm">
            <div className="font-semibold">Today's target</div>
            <div className="text-ink-2">
              Target {progress.target} · completed {progress.completed}
            </div>
            <div className="text-ink-2">{progress.remaining} remaining</div>
            <div className="mt-1 font-medium">Bonus {formatCurrency(progress.bonus)}</div>
            {progress.excluded.length > 0 && (
              <div
                className="mt-1 text-xs text-ink-2"
                title={progress.excluded.map((e) => `${e.retailer.id}: ${e.exclusion}`).join('\n')}
              >
                {progress.excluded.length} record(s) excluded
              </div>
            )}
          </div>
        </Card>
      </div>

      <h2 className="mb-2 mt-6 font-semibold">Retailers</h2>
      <DataTable
        caption="Retailers of this distributor"
        columns={retailerColumns}
        rows={details.retailers}
        rowKey={(r) => r.id}
        pageSize={8}
        initialSort={{ key: 'onboarded', direction: 'desc' }}
        emptyTitle="No retailers yet"
        emptyDescription="This distributor hasn't onboarded any retailers."
      />

      <h2 className="mb-2 mt-6 font-semibold">Recent commission activity</h2>
      <DataTable
        caption="Recent ledger entries"
        columns={ledgerColumns}
        rows={details.recentLedger}
        rowKey={(e) => e.id}
        pageSize={8}
        emptyTitle="No commissions yet"
      />
    </>
  )
}
