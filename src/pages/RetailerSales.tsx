import { Download } from 'lucide-react'
import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { DataTable, type Column } from '@/components/common/DataTable'
import { EmptyState } from '@/components/common/EmptyState'
import { DateRangeFilter, FilterBar, SearchInput } from '@/components/common/Filters'
import { PageHeader } from '@/components/common/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { defaultCommissionConfig } from '@/config/commissionConfig'
import { isWithinDayRange, parseISO } from '@/domain/dateUtils'
import { sumMoney } from '@/domain/money'
import { useRetailer, useRetailerSales } from '@/hooks/useRetailers'
import { useUrlFilters } from '@/hooks/useUrlFilters'
import type { Sale } from '@/types'
import { downloadCsv, toCsv } from '@/utils/csv'
import { formatCurrency } from '@/utils/currencyFormatter'
import { formatShortDate } from '@/utils/dateFormatter'
import { ApiError } from '@/services/apiClient'

const { sale: rates, businessTimeZone } = defaultCommissionConfig
const remainderPct =
  100 - rates.retailerPercentage - rates.distributorPercentage - rates.companyPercentage

const money = (get: (s: Sale) => number) => (rows: readonly Sale[]) =>
  formatCurrency(sumMoney(rows.map(get)))

const columns: Column<Sale>[] = [
  { key: 'invoice', header: 'Invoice', cell: (s) => s.id, sortValue: (s) => s.id },
  { key: 'date', header: 'Date', cell: (s) => formatShortDate(s.date), sortValue: (s) => s.date },
  { key: 'product', header: 'Product', cell: (s) => s.product, sortValue: (s) => s.product },
  {
    key: 'qty',
    header: 'Qty',
    align: 'right',
    cell: (s) => s.quantity,
    sortValue: (s) => s.quantity,
    footer: (rows) => sumMoney(rows.map((s) => s.quantity)),
  },
  {
    key: 'sale',
    header: 'Sale',
    align: 'right',
    cell: (s) => formatCurrency(s.amount),
    sortValue: (s) => s.amount,
    footer: money((s) => s.amount),
  },
  {
    key: 'retailer',
    header: `Retailer ${rates.retailerPercentage}%`,
    align: 'right',
    cell: (s) => formatCurrency(s.retailerCommission),
    sortValue: (s) => s.retailerCommission,
    footer: money((s) => s.retailerCommission),
  },
  {
    key: 'distributor',
    header: `Distributor ${rates.distributorPercentage}%`,
    align: 'right',
    cell: (s) => formatCurrency(s.distributorCommission),
    sortValue: (s) => s.distributorCommission,
    footer: money((s) => s.distributorCommission),
  },
  {
    key: 'company',
    header: `Company ${rates.companyPercentage}%`,
    align: 'right',
    cell: (s) => formatCurrency(s.companyCommission),
    sortValue: (s) => s.companyCommission,
    footer: money((s) => s.companyCommission),
  },
  {
    key: 'remainder',
    header: `Remainder ${remainderPct}%`,
    align: 'right',
    cell: (s) => formatCurrency(s.remainder),
    sortValue: (s) => s.remainder,
    footer: money((s) => s.remainder),
  },
]

export default function RetailerSales() {
  const { id } = useParams()
  const { retailer, distributor, error: retailerError } = useRetailer(id)
  const { sales, isLoading, error, refetch } = useRetailerSales(id)
  const [filters, update] = useUrlFilters(['q', 'from', 'to'])

  const filtered = useMemo(() => {
    const query = filters.q.trim().toLowerCase()
    return sales.filter((sale) => {
      if (query && !`${sale.id} ${sale.product}`.toLowerCase().includes(query)) return false
      const date = parseISO(sale.date)
      return date ? isWithinDayRange(date, filters.from, filters.to, businessTimeZone) : false
    })
  }, [sales, filters.q, filters.from, filters.to])

  if (retailerError instanceof ApiError && retailerError.status === 404) {
    return (
      <Card>
        <EmptyState
          title="Retailer not found"
          description={`There is no retailer with ID ${id}.`}
          action={
            <Link to="/dashboard" className="text-brand hover:underline">
              Back to dashboard
            </Link>
          }
        />
      </Card>
    )
  }

  const hasFilters = !!(filters.q || filters.from || filters.to)

  const exportCsv = () =>
    downloadCsv(
      `${id}-sales.csv`,
      toCsv(
        [
          'Invoice',
          'Date',
          'Product',
          'Qty',
          'Sale',
          'Retailer',
          'Distributor',
          'Company',
          'Remainder',
        ],
        filtered.map((s) => [
          s.id,
          s.date,
          s.product,
          s.quantity,
          s.amount / 100,
          s.retailerCommission / 100,
          s.distributorCommission / 100,
          s.companyCommission / 100,
          s.remainder / 100,
        ]),
      ),
    )

  return (
    <>
      <PageHeader
        crumbs={[
          { label: 'Network', to: '/distributors/network' },
          ...(distributor
            ? [{ label: distributor.name, to: `/distributors/${distributor.id}` }]
            : []),
          { label: retailer?.name ?? String(id), to: `/retailers/${id}` },
          { label: 'Sales' },
        ]}
        title={`${retailer?.name ?? id} · Sales`}
        description="Every invoice with the split between retailer, distributor and company. The remainder is shown explicitly."
        actions={
          <Button onClick={exportCsv} disabled={filtered.length === 0}>
            <Download className="size-4" />
            Export CSV
          </Button>
        }
      />

      <DataTable
        caption="Retailer sales"
        columns={columns}
        rows={filtered}
        rowKey={(s) => s.id}
        isLoading={isLoading}
        error={error}
        onRetry={refetch}
        initialSort={{ key: 'date', direction: 'desc' }}
        emptyTitle={hasFilters ? 'No sales match your filters' : 'No sales yet'}
        emptyDescription={
          hasFilters
            ? 'Try a different search or widen the date range.'
            : 'Sales will appear here once this retailer makes one.'
        }
        footerLabel="Totals"
        toolbar={
          <FilterBar>
            <SearchInput
              label="Search invoice or product"
              value={filters.q}
              onChange={(q) => update({ q })}
              placeholder="INV-1022, Product A…"
            />
            <DateRangeFilter from={filters.from} to={filters.to} onChange={update} />
          </FilterBar>
        }
      />
    </>
  )
}
