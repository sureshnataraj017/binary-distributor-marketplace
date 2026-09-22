import { Ban, CirclePause, CirclePlay, type LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { FormMessage } from '@/components/molecules/FormField'
import { Button } from '@/components/atoms/Button'
import { useSetRetailerStatus } from '@/hooks/useEntryMutations'
import { ApiError } from '@/services/apiClient'
import type { Retailer, RetailerStatus } from '@/types'

const ACTIONS: Record<
  RetailerStatus,
  { to: RetailerStatus; label: string; icon: LucideIcon; confirm?: string }[]
> = {
  ACTIVE: [
    { to: 'DEACTIVATED', label: 'Deactivate', icon: CirclePause },
    {
      to: 'CANCELLED',
      label: 'Cancel retailer',
      icon: Ban,
      confirm: 'Cancel this retailer? A cancelled retailer can never be reactivated.',
    },
  ],
  DEACTIVATED: [
    { to: 'ACTIVE', label: 'Reactivate', icon: CirclePlay },
    {
      to: 'CANCELLED',
      label: 'Cancel retailer',
      icon: Ban,
      confirm: 'Cancel this retailer? A cancelled retailer can never be reactivated.',
    },
  ],
  CANCELLED: [],
}

/** Change a retailer's status. Cancelling is final, so it asks first. */
export function RetailerStatusControl({ retailer }: { retailer: Retailer }) {
  const setStatus = useSetRetailerStatus()
  const [message, setMessage] = useState<string | null>(null)
  const actions = ACTIONS[retailer.status]

  if (actions.length === 0) return null

  const run = (to: RetailerStatus, confirm?: string) => {
    if (confirm && !window.confirm(confirm)) return
    setMessage(null)
    setStatus.mutate(
      { id: retailer.id, status: to },
      {
        onError: (error) =>
          setMessage(error instanceof ApiError ? error.message : 'Something went wrong.'),
      },
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {actions.map((action) => (
        <Button
          key={action.to}
          variant="secondary"
          disabled={setStatus.isPending}
          onClick={() => run(action.to, action.confirm)}
        >
          <action.icon className="size-4" />
          {action.label}
        </Button>
      ))}
      {message && <FormMessage tone="error">{message}</FormMessage>}
    </div>
  )
}
