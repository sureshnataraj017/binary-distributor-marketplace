import { useEffect, useState } from 'react'

/** Current time, refreshed every minute so "today" figures roll over at the day boundary. */
export function useNow(refreshMs = 60_000): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), refreshMs)
    return () => clearInterval(id)
  }, [refreshMs])
  return now
}
