import { Search } from 'lucide-react'
import { useEffect, useId, useState, type ReactNode } from 'react'
import { DatePicker } from '@/components/atoms/DatePicker'
import { Select } from '@/components/atoms/Select'
import { Button } from '@/components/atoms/Button'

const controlClass =
  'rounded-lg border border-line-strong bg-surface px-3 py-1.5 text-sm text-ink placeholder:text-muted'

export function FilterBar({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-end gap-3">{children}</div>
}

export function Field({
  label,
  id,
  children,
}: {
  label: string
  id?: string
  children: ReactNode
}) {
  return (
    <label htmlFor={id} className="flex flex-col gap-1 text-xs font-medium text-ink-2">
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
      <div className="relative">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted"
        />
        <input
          type="search"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={placeholder}
          className={`${controlClass} w-56 pl-8`}
        />
      </div>
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
  const fromId = useId()
  const toId = useId()
  const invalid = !!from && !!to && from > to
  return (
    <>
      <Field label="From" id={fromId}>
        <DatePicker
          id={fromId}
          value={from}
          max={to || undefined}
          onChange={(value) => onChange({ from: value, to })}
        />
      </Field>
      <Field label="To" id={toId}>
        <DatePicker
          id={toId}
          value={to}
          min={from || undefined}
          invalid={invalid}
          onChange={(value) => onChange({ from, to: value })}
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
  const id = useId()
  return (
    <Field label={label} id={id}>
      <div className="w-44">
        <Select
          inputId={id}
          isClearable={false}
          value={value}
          onChange={(v) => onChange(v as T | '')}
          options={options}
        />
      </div>
    </Field>
  )
}
