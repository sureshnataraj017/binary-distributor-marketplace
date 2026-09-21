import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { DataTable, type Column } from '@/components/common/DataTable'
import { DateRangeFilter, FilterBar, SearchInput, SelectFilter } from '@/components/common/Filters'
import { PageHeader } from '@/components/common/PageHeader'
import { StatusBadge } from '@/components/common/StatusBadge'
import { Button } from '@/components/ui/Button'
import { defaultCommissionConfig } from '@/config/commissionConfig'
import { isWithinDayRange, parseISO } from '@/domain/dateUtils'
import { sumMoney } from '@/domain/money'
import { useCommissions } from '@/hooks/useCommissions'
import { useUrlFilters } from '@/hooks/useUrlFilters'
import type { LedgerEntry, LedgerEntryType, LedgerStatus } from '@/types'
import { downloadCsv, toCsv } from '@/utils/csv'
import { formatCurrency } from '@/utils/currencyFormatter'
import { formatShortDate, humanize } from '@/utils/dateFormatter'

const TYPES: LedgerEntryType[] = [
  'ONBOARDING',
  'RETAILER_SALE',
  'DISTRIBUTOR_REFERRAL',
  'DOWNLINE_SALE',
]
const STATUSES: LedgerStatus[] = ['EARNED', 'PENDING']

export default function CommissionLedger() {
  const { ledger, retailerBySale, isLoading, error, refetch } = useCommissions()
  const [filters, update] = useUrlFilters(['q', 'type', 'status', 'from', 'to'])

  const rows = useMemo(() => {
    const query = filters.q.trim().toLowerCase()
    return ledger.filter((entry) => {
      if (filters.type && entry.type !== filters.type) return false
      if (filters.status && entry.status !== filters.status) return false
      if (query && !`${entry.entity} ${entry.reference}`.toLowerCase().includes(query)) return false
      const date = parseISO(entry.date)
      return date
        ? isWithinDayRange(date, filters.from, filters.to, defaultCommissionConfig.businessTimeZone)
        : false
    })
  }, [ledger, filters])

  const referenceLink = (entry: LedgerEntry) => {
    const { reference } = entry
    let to: string | null = null
    if (reference.startsWith('RET-')) to = `/retailers/${reference}`
    else if (reference.startsWith('DIST-')) to = `/distributors/${reference}`
    else if (reference.startsWith('INV-') && retailerBySale.has(reference)) {
      to = `/retailers/${retailerBySale.get(reference)}/sales?q=${reference}`
    }
    return to ? (
      <Link to={to} className="text-brand hover:underline">
        {reference}
      </Link>
    ) : (
      reference
    )
  }

  const columns: Column<LedgerEntry>[] = [
    { key: 'date', header: 'Date', cell: (e) => formatShortDate(e.date), sortValue: (e) => e.date },
    {
      key: 'entity',
      header: 'Entity',
      cell: (e) =>
        e.entity.startsWith('DIST-') ? (
          <Link to={`/distributors/${e.entity}`} className="text-brand hover:underline">
            {e.entity}
          </Link>
        ) : (
          e.entity
        ),
      sortValue: (e) => e.entity,
    },
    {
      key: 'type',
      header: 'Type',
      cell: (e) => <span className="font-mono text-xs">{e.type}</span>,
      sortValue: (e) => e.type,
    },
    { key: 'reference', header: 'Reference', cell: referenceLink, sortValue: (e) => e.reference },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      cell: (e) => formatCurrency(e.amount),
      sortValue: (e) => e.amount,
      footer: (all) => formatCurrency(sumMoney(all.map((e) => e.amount))),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (e) => <StatusBadge status={e.status} />,
      sortValue: (e) => e.status,
    },
  ]

  const exportCsv = () =>
    downloadCsv(
      'commission-ledger.csv',
      toCsv(
        ['Date', 'Entity', 'Type', 'Reference', 'Amount', 'Status'],
        rows.map((e) => [e.date, e.entity, e.type, e.reference, e.amount / 100, e.status]),
      ),
    )

  const hasFilters = Object.values(filters).some(Boolean)

  return (
    <>
      <PageHeader
        title="Commission ledger"
        description="Every commission event: onboarding bonuses, retailer sales, referrals and company downline commission."
        actions={
          <Button onClick={exportCsv} disabled={rows.length === 0}>
            Export CSV
          </Button>
        }
      />
      <DataTable
        caption="Commission ledger"
        columns={columns}
        rows={rows}
        rowKey={(e) => e.id}
        isLoading={isLoading}
        error={error}
        onRetry={refetch}
        pageSize={12}
        initialSort={{ key: 'date', direction: 'desc' }}
        emptyTitle={hasFilters ? 'No entries match your filters' : 'No commissions yet'}
        footerLabel="Total"
        toolbar={
          <FilterBar>
            <SearchInput
              label="Search entity or reference"
              value={filters.q}
              onChange={(q) => update({ q })}
              placeholder="DIST-001, INV-1022…"
            />
            <SelectFilter
              label="Type"
              value={filters.type as LedgerEntryType | ''}
              onChange={(type) => update({ type })}
              options={[
                { value: '', label: 'All types' },
                ...TYPES.map((t) => ({ value: t, label: humanize(t) })),
              ]}
            />
            <SelectFilter
              label="Status"
              value={filters.status as LedgerStatus | ''}
              onChange={(status) => update({ status })}
              options={[
                { value: '', label: 'All statuses' },
                ...STATUSES.map((s) => ({ value: s, label: humanize(s) })),
              ]}
            />
            <DateRangeFilter from={filters.from} to={filters.to} onChange={update} />
          </FilterBar>
        }
      />
    </>
  )
}
