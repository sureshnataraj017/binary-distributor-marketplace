import { useQuery } from '@tanstack/react-query'
import { useId, useMemo } from 'react'
import { ALL_STATES, INDIA_STATES } from '@/config/indiaStates'
import { distributorService } from '@/services/distributorService'
import { Select } from '@/components/ui/Select'
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
  const id = useId()

  return (
    <label htmlFor={id} className="flex items-center gap-2 text-sm text-ink-2">
      <span className="hidden sm:inline">State</span>
      <div className="w-56">
        <Select
          inputId={id}
          isClearable={false}
          value={selectedState}
          onChange={setSelectedState}
          options={[
            { value: ALL_STATES, label: `All India (${distributors?.length ?? '…'})` },
            {
              label: 'States with distributors',
              options: withData.map((state) => ({
                value: state,
                label: `${state} (${counts.get(state)})`,
              })),
            },
            {
              label: 'No distributors yet',
              options: withoutData.map((state) => ({ value: state, label: state })),
            },
          ]}
        />
      </div>
    </label>
  )
}
