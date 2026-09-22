import { TriangleAlert } from 'lucide-react'
import { Button } from '@/components/atoms/Button'

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message = error instanceof Error ? error.message : 'Something went wrong.'
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center"
    >
      <div
        aria-hidden="true"
        className="flex size-10 items-center justify-center rounded-full bg-critical-soft text-critical"
      >
        <TriangleAlert className="size-5" />
      </div>
      <p className="font-medium">We couldn't load this</p>
      <p className="max-w-sm text-sm text-ink-2">{message}</p>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  )
}
