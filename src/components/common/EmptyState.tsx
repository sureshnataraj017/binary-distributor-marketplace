import { Inbox } from 'lucide-react'
import type { ReactNode } from 'react'

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      <div
        aria-hidden="true"
        className="flex size-10 items-center justify-center rounded-full bg-hover text-muted"
      >
        <Inbox className="size-5" />
      </div>
      <p className="font-medium">{title}</p>
      {description && <p className="max-w-sm text-sm text-ink-2">{description}</p>}
      {action}
    </div>
  )
}
