import { Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { DataTable, type Column } from '@/components/organisms/DataTable'
import { FilterBar, SearchInput } from '@/components/molecules/Filters'
import { PageHeader } from '@/components/molecules/PageHeader'
import { AddDistributorForm } from '@/components/organisms/AddDistributorForm'
import { Button } from '@/components/atoms/Button'
import { useMarketplaceData } from '@/hooks/useMarketplaceData'
import { useUrlFilters } from '@/hooks/useUrlFilters'
import type { Distributor } from '@/types'
import { formatCurrency } from '@/utils/currencyFormatter'
import { formatDate } from '@/utils/dateFormatter'

export default function Distributors() {
  const { all, data, summaries, selectedState, isScoped, isLoading, error, refetch } =
    useMarketplaceData()
  const [formOpen, setFormOpen] = useState(false)
  const [filters, update] = useUrlFilters(['q'])

  const byId = useMemo(() => new Map((all?.distributors ?? []).map((d) => [d.id, d])), [all])

  const rows = useMemo(() => {
    const query = filters.q.trim().toLowerCase()
    return (data?.distributors ?? []).filter(
      (d) => !query || `${d.id} ${d.name} ${d.city} ${d.state}`.toLowerCase().includes(query),
    )
  }, [data, filters.q])

  const columns: Column<Distributor>[] = [
    {
      key: 'id',
      header: 'ID',
      cell: (d) => (
        <Link to={`/distributors/${d.id}`} className="text-brand hover:underline">
          {d.id}
        </Link>
      ),
      sortValue: (d) => d.id,
    },
    { key: 'name', header: 'Name', cell: (d) => d.name, sortValue: (d) => d.name },
    { key: 'state', header: 'State', cell: (d) => d.state, sortValue: (d) => d.state },
    { key: 'city', header: 'City', cell: (d) => d.city, sortValue: (d) => d.city },
    {
      key: 'placement',
      header: 'Placement',
      cell: (d) =>
        d.parentId
          ? `${d.position === 'LEFT' ? 'Left' : 'Right'} of ${byId.get(d.parentId)?.name ?? d.parentId}`
          : 'Top level',
      sortValue: (d) => d.parentId ?? '',
    },
    {
      key: 'referredBy',
      header: 'Referred by',
      cell: (d) => (d.referredBy ? (byId.get(d.referredBy)?.name ?? d.referredBy) : '—'),
      sortValue: (d) => d.referredBy ?? '',
    },
    {
      key: 'retailers',
      header: 'Retailers',
      align: 'right',
      cell: (d) => summaries?.get(d.id)?.retailerCount ?? 0,
      sortValue: (d) => summaries?.get(d.id)?.retailerCount ?? 0,
    },
    {
      key: 'sales',
      header: 'Total sales',
      align: 'right',
      cell: (d) => formatCurrency(summaries?.get(d.id)?.totalSales ?? 0),
      sortValue: (d) => summaries?.get(d.id)?.totalSales ?? 0,
    },
    {
      key: 'joined',
      header: 'Joined',
      cell: (d) => formatDate(d.joinedAt),
      sortValue: (d) => d.joinedAt,
    },
  ]

  const nothingYet = !isLoading && !error && (all?.distributors.length ?? 0) === 0

  return (
    <>
      <PageHeader
        title="Distributors"
        description={
          isScoped
            ? `Distributors in ${selectedState}`
            : 'Everyone in the network, added one at a time.'
        }
        actions={
          <Button variant="primary" disabled={formOpen} onClick={() => setFormOpen(true)}>
            <Plus className="size-4" />
            Add distributor
          </Button>
        }
      />

      {formOpen && (
        <AddDistributorForm
          distributors={all?.distributors ?? []}
          onClose={() => setFormOpen(false)}
        />
      )}

      <DataTable
        caption="Distributors"
        columns={columns}
        rows={rows}
        rowKey={(d) => d.id}
        isLoading={isLoading}
        error={error}
        onRetry={refetch}
        initialSort={{ key: 'id', direction: 'asc' }}
        emptyTitle={
          nothingYet
            ? 'No distributors yet'
            : filters.q
              ? 'No distributors match your search'
              : 'No distributors here yet'
        }
        emptyDescription={
          nothingYet
            ? 'Use "Add distributor" to enter your first one. Everything else builds from there.'
            : isScoped
              ? `There are no distributors in ${selectedState}. Pick another state or add one.`
              : 'Try a different search.'
        }
        toolbar={
          <FilterBar>
            <SearchInput
              label="Search"
              value={filters.q}
              onChange={(q) => update({ q })}
              placeholder="Name, ID or city…"
            />
          </FilterBar>
        }
      />
    </>
  )
}
