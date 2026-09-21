import { useMemo, useState } from 'react'

export type SortDirection = 'asc' | 'desc'
export interface SortState {
  key: string
  direction: SortDirection
}

export type SortValue = string | number | null | undefined

interface Options<T> {
  pageSize: number
  initialSort?: SortState
  /** Maps a column key to the value used for ordering. */
  sortValues: Record<string, (row: T) => SortValue>
}

const compare = (a: SortValue, b: SortValue): number => {
  if (a == null && b == null) return 0
  if (a == null) return 1 // nulls always last
  if (b == null) return -1
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a).localeCompare(String(b), undefined, { numeric: true })
}

/** Sorting + pagination for any list. Pure presentation state, no data fetching. */
export function useTableState<T>(
  rows: readonly T[],
  { pageSize, initialSort, sortValues }: Options<T>,
) {
  const [sort, setSort] = useState<SortState | null>(initialSort ?? null)
  const [requestedPage, setPage] = useState(1)

  const sorted = useMemo(() => {
    const getValue = sort ? sortValues[sort.key] : undefined
    if (!sort || !getValue) return [...rows]
    const factor = sort.direction === 'asc' ? 1 : -1
    return rows
      .map((row, index) => ({ row, index }))
      .sort((a, b) => factor * compare(getValue(a.row), getValue(b.row)) || a.index - b.index)
      .map(({ row }) => row)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, sort])

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize))
  const page = Math.min(requestedPage, pageCount) // never stranded past the last page after filtering
  const pageRows = useMemo(
    () => sorted.slice((page - 1) * pageSize, page * pageSize),
    [sorted, page, pageSize],
  )

  const toggleSort = (key: string) => {
    setPage(1)
    setSort((current) =>
      current?.key === key
        ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: 'asc' },
    )
  }

  return {
    sort,
    toggleSort,
    page,
    setPage,
    pageCount,
    pageRows,
    sorted,
    total: sorted.length,
    pageSize,
  }
}
