import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { ALL_STATES, INDIA_STATES } from '@/config/indiaStates'
import { distributorService } from '@/services/distributorService'
import { useFilterStore } from '@/store/filterStore'

/** Global India state filter. Scopes KPIs, lists, ledger and the network tree. */
export function StateFilter() {
  const selectedState = useFilterStore((s) => s.selectedState)
  const setSelectedState = useFilterStore((s) => s.setSelectedState)
  const { data: distributors } = useQuery({
    queryKey: ['distributors'],
    queryFn: distributorService.list,
  })

  const counts = useMemo(() => {
    const map = new Map<string, number>()
    for (const d of distributors ?? []) map.set(d.state, (map.get(d.state) ?? 0) + 1)
    return map
  }, [distributors])

  const withData = INDIA_STATES.filter((s) => counts.has(s))
  const withoutData = INDIA_STATES.filter((s) => !counts.has(s))

  return (
    <label className="flex items-center gap-2 text-sm text-ink-2">
      <span className="hidden sm:inline">State</span>
      <select
        value={selectedState}
        onChange={(e) => setSelectedState(e.target.value)}
        className="rounded-lg border border-line-strong bg-surface px-3 py-1.5 text-sm text-ink"
      >
        <option value={ALL_STATES}>All India ({distributors?.length ?? '…'})</option>
        <optgroup label="States with distributors">
          {withData.map((state) => (
            <option key={state} value={state}>
              {state} ({counts.get(state)})
            </option>
          ))}
        </optgroup>
        <optgroup label="No distributors yet">
          {withoutData.map((state) => (
            <option key={state} value={state}>
              {state}
            </option>
          ))}
        </optgroup>
      </select>
    </label>
  )
}
