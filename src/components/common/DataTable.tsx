import { ChevronDown, ChevronUp, ChevronsUpDown } from 'lucide-react'
import type { ReactNode } from 'react'
import { Card } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { Button } from '@/components/ui/Button'
import { useTableState, type SortState, type SortValue } from '@/hooks/useTableState'
import { EmptyState } from './EmptyState'
import { ErrorState } from './ErrorState'

export interface Column<T> {
  key: string
  header: ReactNode
  cell: (row: T) => ReactNode
  /** Makes the column sortable. */
  sortValue?: (row: T) => SortValue
  align?: 'left' | 'right'
  /** Totals cell, computed over ALL rows that match the current filters (not just the visible page). */
  footer?: (rows: readonly T[]) => ReactNode
}

interface DataTableProps<T> {
  caption: string
  columns: readonly Column<T>[]
  rows: readonly T[]
  rowKey: (row: T) => string
  isLoading?: boolean
  error?: unknown
  onRetry?: () => void
  emptyTitle?: string
  emptyDescription?: string
  pageSize?: number
  initialSort?: SortState
  footerLabel?: string
  toolbar?: ReactNode
}

export function DataTable<T>({
  caption,
  columns,
  rows,
  rowKey,
  isLoading,
  error,
  onRetry,
  emptyTitle = 'Nothing to show',
  emptyDescription = 'Try adjusting your filters.',
  pageSize = 10,
  initialSort,
  footerLabel = 'Total',
  toolbar,
}: DataTableProps<T>) {
  const sortValues = Object.fromEntries(
    columns.flatMap((c) => (c.sortValue ? [[c.key, c.sortValue]] : [])),
  )
  const table = useTableState(rows, { pageSize, initialSort, sortValues })
  const hasFooter = columns.some((c) => c.footer)
  const showBody = !isLoading && !error && rows.length > 0
  const alignClass = (align?: 'left' | 'right') => (align === 'right' ? 'text-right' : 'text-left')
  const from = table.total === 0 ? 0 : (table.page - 1) * pageSize + 1
  const to = Math.min(table.page * pageSize, table.total)

  return (
    <Card className="overflow-hidden">
      {toolbar && <div className="border-b border-line p-3">{toolbar}</div>}
      <div className="overflow-x-auto">
        <table className="w-full min-w-max text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead className="bg-hover text-xs uppercase tracking-wide text-ink-2">
            <tr>
              {columns.map((column) => {
                const active = table.sort?.key === column.key
                return (
                  <th
                    key={column.key}
                    scope="col"
                    aria-sort={
                      active
                        ? table.sort!.direction === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : undefined
                    }
                    className={`px-4 py-2.5 font-medium ${alignClass(column.align)}`}
                  >
                    {column.sortValue ? (
                      <button
                        type="button"
                        onClick={() => table.toggleSort(column.key)}
                        className="inline-flex items-center gap-1 uppercase tracking-wide hover:text-ink"
                      >
                        {column.header}
                        <span aria-hidden="true" className={active ? 'text-ink' : 'text-muted'}>
                          {active ? (
                            table.sort!.direction === 'asc' ? (
                              <ChevronUp className="size-3.5" />
                            ) : (
                              <ChevronDown className="size-3.5" />
                            )
                          ) : (
                            <ChevronsUpDown className="size-3.5" />
                          )}
                        </span>
                      </button>
                    ) : (
                      column.header
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>

          {isLoading && (
            <tbody aria-busy="true">
              {Array.from({ length: 5 }, (_, r) => (
                <tr key={r} className="border-t border-line">
                  {columns.map((c) => (
                    <td key={c.key} className="px-4 py-3">
                      <Skeleton className="h-4 w-full max-w-28" />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          )}

          {showBody && (
            <tbody>
              {table.pageRows.map((row) => (
                <tr key={rowKey(row)} className="border-t border-line hover:bg-hover">
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={`px-4 py-2.5 tabular-nums ${alignClass(column.align)}`}
                    >
                      {column.cell(row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          )}

          {showBody && hasFooter && (
            <tfoot className="border-t-2 border-line-strong bg-hover font-semibold">
              <tr>
                {columns.map((column, i) => (
                  <td
                    key={column.key}
                    className={`px-4 py-2.5 tabular-nums ${alignClass(column.align)}`}
                  >
                    {column.footer
                      ? column.footer(table.sorted)
                      : i === 0
                        ? `${footerLabel} (${table.total})`
                        : null}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {!isLoading && !!error && <ErrorState error={error} onRetry={onRetry} />}
      {!isLoading && !error && rows.length === 0 && (
        <EmptyState title={emptyTitle} description={emptyDescription} />
      )}

      {showBody && (
        <nav
          aria-label="Pagination"
          className="flex items-center justify-between gap-3 border-t border-line px-4 py-2.5 text-sm text-ink-2"
        >
          <span>
            Showing {from}–{to} of {table.total}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              disabled={table.page <= 1}
              onClick={() => table.setPage(table.page - 1)}
            >
              Previous
            </Button>
            <span aria-live="polite">
              Page {table.page} of {table.pageCount}
            </span>
            <Button
              variant="secondary"
              disabled={table.page >= table.pageCount}
              onClick={() => table.setPage(table.page + 1)}
            >
              Next
            </Button>
          </div>
        </nav>
      )}
    </Card>
  )
}
