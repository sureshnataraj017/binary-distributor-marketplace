import { CircleAlert, CircleCheck } from 'lucide-react'
import type { ReactNode } from 'react'

/** Shared look for text inputs, selects and date pickers across every entry form. */
export const controlClass =
  'w-full rounded-lg border border-line-strong bg-surface px-3 py-1.5 text-sm text-ink placeholder:text-muted aria-[invalid=true]:border-critical disabled:opacity-60'

export function FormField({
  label,
  id,
  error,
  hint,
  children,
}: {
  label: string
  /** Associates the label with a `Select`/`DatePicker` control, which need an explicit id (unlike a native `<select>`). */
  id?: string
  error?: string
  hint?: string
  children: ReactNode
}) {
  return (
    <label htmlFor={id} className="flex flex-col gap-1 text-xs font-medium text-ink-2">
      {label}
      {children}
      {hint && !error && <span className="font-normal text-muted">{hint}</span>}
      {error && (
        <span role="alert" className="font-normal text-critical">
          {error}
        </span>
      )}
    </label>
  )
}

/** Banner shown under a form after the server refuses a request or after a successful save. */
export function FormMessage({
  tone,
  children,
}: {
  tone: 'error' | 'success'
  children: ReactNode
}) {
  return tone === 'error' ? (
    <p
      role="alert"
      className="flex items-center gap-1.5 rounded-lg bg-critical-soft px-3 py-2 text-sm text-critical"
    >
      <CircleAlert aria-hidden="true" className="size-4 shrink-0" />
      {children}
    </p>
  ) : (
    <p
      role="status"
      className="flex items-center gap-1.5 rounded-lg bg-good-soft px-3 py-2 text-sm font-medium text-good"
    >
      <CircleCheck aria-hidden="true" className="size-4 shrink-0" />
      {children}
    </p>
  )
}
