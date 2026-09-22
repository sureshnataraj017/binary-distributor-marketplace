import ReactSelect, { type GroupBase } from 'react-select'

export interface SelectOption {
  value: string
  label: string
}

/** Either flat options or grouped options (react-select's `GroupBase`), same shape as `<optgroup>`. */
export type SelectOptions = readonly (SelectOption | GroupBase<SelectOption>)[]

function flatten(options: SelectOptions): readonly SelectOption[] {
  return options.flatMap((o) => ('options' in o ? o.options : [o]))
}

interface Props {
  inputId?: string
  value: string
  onChange: (value: string) => void
  options: SelectOptions
  placeholder?: string
  invalid?: boolean
  disabled?: boolean
  isClearable?: boolean
  'aria-label'?: string
}

/** Searchable, styled replacement for a native `<select>`. Value/onChange stay plain strings. */
export function Select({
  inputId,
  value,
  onChange,
  options,
  placeholder = 'Select…',
  invalid = false,
  disabled = false,
  isClearable = true,
  'aria-label': ariaLabel,
}: Props) {
  const selected = flatten(options).find((o) => o.value === value) ?? null

  return (
    <ReactSelect<SelectOption, false>
      inputId={inputId}
      aria-label={ariaLabel}
      aria-invalid={invalid}
      unstyled
      isDisabled={disabled}
      isClearable={isClearable}
      placeholder={placeholder}
      value={selected}
      onChange={(option) => onChange(option?.value ?? '')}
      options={options}
      classNames={{
        control: ({ isFocused }) =>
          `!min-h-0 rounded-lg border bg-surface px-2 py-1 text-sm transition ${
            invalid
              ? 'border-critical'
              : isFocused
                ? 'border-brand shadow-[0_0_0_3px_var(--brand-soft)]'
                : 'border-line-strong'
          }`,
        valueContainer: () => '!py-0 gap-1',
        placeholder: () => 'text-muted',
        singleValue: () => 'text-ink',
        input: () => 'text-ink',
        menu: () => 'z-20 mt-1 overflow-hidden rounded-lg border border-line bg-surface shadow-lg',
        menuList: () => 'max-h-64 overflow-auto py-1',
        groupHeading: () =>
          'px-3 pt-2 pb-1 text-xs font-semibold uppercase tracking-wide text-muted',
        option: ({ isFocused, isSelected }) =>
          `cursor-pointer px-3 py-1.5 text-sm ${
            isSelected
              ? 'bg-brand-soft font-medium text-ink'
              : isFocused
                ? 'bg-hover text-ink'
                : 'text-ink'
          }`,
        noOptionsMessage: () => 'px-3 py-2 text-sm text-muted',
        indicatorSeparator: () => 'hidden',
        dropdownIndicator: () => 'px-2 text-muted',
        clearIndicator: () => 'cursor-pointer px-1 text-muted hover:text-ink',
      }}
    />
  )
}
