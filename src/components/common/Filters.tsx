import { useEffect, useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/Button'

const controlClass =
  'rounded-lg border border-line-strong bg-surface px-3 py-1.5 text-sm text-ink placeholder:text-muted'

export function FilterBar({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-end gap-3">{children}</div>
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-ink-2">
      {label}
      {children}
    </label>
  )
}

/** Text search that only reports changes after the user pauses typing. */
export function SearchInput({
  value,
  onChange,
  placeholder = 'Search…',
  label = 'Search',
  delay = 250,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  label?: string
  delay?: number
}) {
  const [draft, setDraft] = useState(value)
  const [syncedValue, setSyncedValue] = useState(value)

  // Adopt external changes (e.g. "clear filters" or back navigation) without an effect.
  if (value !== syncedValue) {
    setSyncedValue(value)
    setDraft(value)
  }

  useEffect(() => {
    if (draft === value) return
    const id = setTimeout(() => onChange(draft), delay)
    return () => clearTimeout(id)
  }, [draft, value, onChange, delay])

  return (
    <Field label={label}>
      <input
        type="search"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={placeholder}
        className={`${controlClass} w-56`}
      />
    </Field>
  )
}

export function DateRangeFilter({
  from,
  to,
  onChange,
}: {
  from: string
  to: string
  onChange: (range: { from: string; to: string }) => void
}) {
  const invalid = !!from && !!to && from > to
  return (
    <>
      <Field label="From">
        <input
          type="date"
          value={from}
          max={to || undefined}
          onChange={(e) => onChange({ from: e.target.value, to })}
          className={controlClass}
        />
      </Field>
      <Field label="To">
        <input
          type="date"
          value={to}
          min={from || undefined}
          aria-invalid={invalid}
          onChange={(e) => onChange({ from, to: e.target.value })}
          className={controlClass}
        />
      </Field>
      {(from || to) && (
        <Button variant="ghost" onClick={() => onChange({ from: '', to: '' })}>
          Clear dates
        </Button>
      )}
    </>
  )
}

export function SelectFilter<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T | ''
  options: readonly { value: T | ''; label: string }[]
  onChange: (value: T | '') => void
}) {
  return (
    <Field label={label}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T | '')}
        className={controlClass}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </Field>
  )
}
