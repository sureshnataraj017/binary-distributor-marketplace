import type { ReactNode } from 'react'

/** Shared look for text inputs, selects and date pickers across every entry form. */
export const controlClass =
  'w-full rounded-lg border border-line-strong bg-surface px-3 py-1.5 text-sm text-ink placeholder:text-muted aria-[invalid=true]:border-critical disabled:opacity-60'

export function FormField({
  label,
  error,
  hint,
  children,
}: {
  label: string
  error?: string
  hint?: string
  children: ReactNode
}) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-ink-2">
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
    <p role="alert" className="rounded-lg bg-critical-soft px-3 py-2 text-sm text-critical">
      {children}
    </p>
  ) : (
    <p role="status" className="rounded-lg bg-good-soft px-3 py-2 text-sm font-medium text-good">
      {children}
    </p>
  )
}
