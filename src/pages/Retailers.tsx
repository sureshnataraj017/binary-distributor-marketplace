import { Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { DataTable, type Column } from '@/components/organisms/DataTable'
import { FilterBar, SearchInput, SelectFilter } from '@/components/molecules/Filters'
import { PageHeader } from '@/components/molecules/PageHeader'
import { StatusBadge } from '@/components/molecules/StatusBadge'
import { AddRetailerForm } from '@/components/organisms/AddRetailerForm'
import { Button } from '@/components/atoms/Button'
import { useMarketplaceData } from '@/hooks/useMarketplaceData'
import { useUrlFilters } from '@/hooks/useUrlFilters'
import type { Retailer, RetailerStatus } from '@/types'
import { formatCurrency } from '@/utils/currencyFormatter'
import { formatDate, humanize } from '@/utils/dateFormatter'

const STATUSES: RetailerStatus[] = ['ACTIVE', 'DEACTIVATED', 'CANCELLED']

export default function Retailers() {
  const { all, data, selectedState, isScoped, isLoading, error, refetch } = useMarketplaceData()
  const [formOpen, setFormOpen] = useState(false)
  const [filters, update] = useUrlFilters(['q', 'status'])

  const distributorName = useMemo(
    () => new Map((all?.distributors ?? []).map((d) => [d.id, d.name])),
    [all],
  )
  const salesByRetailer = useMemo(() => {
    const totals = new Map<string, number>()
    for (const sale of data?.sales ?? [])
      totals.set(sale.retailerId, (totals.get(sale.retailerId) ?? 0) + sale.amount)
    return totals
  }, [data])

  const rows = useMemo(() => {
    const query = filters.q.trim().toLowerCase()
    return (data?.retailers ?? []).filter((r) => {
      if (filters.status && r.status !== filters.status) return false
      return !query || `${r.id} ${r.name} ${r.city} ${r.phone ?? ''}`.toLowerCase().includes(query)
    })
  }, [data, filters.q, filters.status])

  const columns: Column<Retailer>[] = [
    {
      key: 'id',
      header: 'ID',
      cell: (r) => (
        <Link to={`/retailers/${r.id}`} className="text-brand hover:underline">
          {r.id}
        </Link>
      ),
      sortValue: (r) => r.id,
    },
    { key: 'name', header: 'Retailer', cell: (r) => r.name, sortValue: (r) => r.name },
    {
      key: 'distributor',
      header: 'Distributor',
      cell: (r) => (
        <Link to={`/distributors/${r.distributorId}`} className="text-brand hover:underline">
          {distributorName.get(r.distributorId) ?? r.distributorId}
        </Link>
      ),
      sortValue: (r) => distributorName.get(r.distributorId) ?? r.distributorId,
    },
    { key: 'state', header: 'State', cell: (r) => r.state, sortValue: (r) => r.state },
    { key: 'city', header: 'City', cell: (r) => r.city, sortValue: (r) => r.city },
    {
      key: 'onboarded',
      header: 'Onboarded',
      cell: (r) => formatDate(r.onboardedAt),
      sortValue: (r) => r.onboardedAt,
    },
    {
      key: 'sales',
      header: 'Total sales',
      align: 'right',
      cell: (r) => formatCurrency(salesByRetailer.get(r.id) ?? 0),
      sortValue: (r) => salesByRetailer.get(r.id) ?? 0,
    },
    {
      key: 'status',
      header: 'Status',
      cell: (r) => <StatusBadge status={r.status} />,
      sortValue: (r) => r.status,
    },
  ]

  const nothingYet = !isLoading && !error && (all?.retailers.length ?? 0) === 0
  const hasFilters = !!(filters.q || filters.status)

  return (
    <>
      <PageHeader
        title="Retailers"
        description={
          isScoped
            ? `Retailers of distributors in ${selectedState}`
            : 'Every retailer, onboarded one at a time by a distributor.'
        }
        actions={
          <Button variant="primary" disabled={formOpen} onClick={() => setFormOpen(true)}>
            <Plus className="size-4" />
            Onboard retailer
          </Button>
        }
      />

      {formOpen && (
        <AddRetailerForm
          distributors={all?.distributors ?? []}
          onClose={() => setFormOpen(false)}
        />
      )}

      <DataTable
        caption="Retailers"
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        isLoading={isLoading}
        error={error}
        onRetry={refetch}
        initialSort={{ key: 'id', direction: 'asc' }}
        emptyTitle={
          nothingYet
            ? 'No retailers yet'
            : hasFilters
              ? 'No retailers match your filters'
              : 'No retailers here yet'
        }
        emptyDescription={
          nothingYet
            ? (all?.distributors.length ?? 0) === 0
              ? 'Add a distributor first, then onboard retailers under them.'
              : 'Use "Onboard retailer" to enter the first one.'
            : 'Try a different search or status.'
        }
        toolbar={
          <FilterBar>
            <SearchInput
              label="Search"
              value={filters.q}
              onChange={(q) => update({ q })}
              placeholder="Name, ID, city or phone…"
            />
            <SelectFilter
              label="Status"
              value={filters.status as RetailerStatus | ''}
              onChange={(status) => update({ status })}
              options={[
                { value: '', label: 'All statuses' },
                ...STATUSES.map((s) => ({ value: s, label: humanize(s) })),
              ]}
            />
          </FilterBar>
        }
      />
    </>
  )
}
