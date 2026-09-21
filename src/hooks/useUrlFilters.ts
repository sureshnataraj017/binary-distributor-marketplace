import { useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'

/**
 * Filter state kept in the URL query string, so a filtered view survives refresh and can be shared.
 * Empty values are removed from the URL.
 */
export function useUrlFilters<K extends string>(keys: readonly K[]) {
  const [params, setParams] = useSearchParams()

  const values = Object.fromEntries(keys.map((key) => [key, params.get(key) ?? ''])) as Record<
    K,
    string
  >

  const update = useCallback(
    (patch: Partial<Record<K, string>>) => {
      setParams(
        (previous) => {
          const next = new URLSearchParams(previous)
          for (const [key, value] of Object.entries<string | undefined>(patch)) {
            if (value) next.set(key, value)
            else next.delete(key)
          }
          return next
        },
        { replace: true },
      )
    },
    [setParams],
  )

  return [values, update] as const
}
