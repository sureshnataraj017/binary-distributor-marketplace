import { format, isValid, parse } from 'date-fns'
import { CalendarDays } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { DayPicker } from 'react-day-picker'
import 'react-day-picker/style.css'

const MARGIN = 8
const DAY_FORMAT = 'yyyy-MM-dd'

function parseDay(value: string | undefined): Date | undefined {
  if (!value) return undefined
  const parsed = parse(value, DAY_FORMAT, new Date())
  return isValid(parsed) ? parsed : undefined
}

interface Props {
  id?: string
  value: string
  onChange: (value: string) => void
  min?: string
  max?: string
  invalid?: boolean
  disabled?: boolean
  placeholder?: string
}

/**
 * Popover calendar replacement for a native `<input type="date">`. Value/onChange stay yyyy-MM-dd strings.
 * The panel is rendered in a portal so it is never clipped by an ancestor's `overflow-hidden` (e.g. a
 * short Card wrapping a small table) and always paints above the page's content.
 */
export function DatePicker({
  id,
  value,
  onChange,
  min,
  max,
  invalid = false,
  disabled = false,
  placeholder = 'Choose a date…',
}: Props) {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [anchor, setAnchor] = useState<DOMRect | null>(null)
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null)
  const open = anchor !== null
  const selected = parseDay(value)
  const minDate = parseDay(min)
  const maxDate = parseDay(max)

  const close = () => {
    setAnchor(null)
    setPosition(null)
  }

  // Measure the panel's real size once it has mounted (off-screen render), then place it below the
  // trigger, flipping above and clamping horizontally so it always stays inside the viewport.
  useLayoutEffect(() => {
    if (!anchor || !panelRef.current) return
    const { width, height } = panelRef.current.getBoundingClientRect()
    let top = anchor.bottom + MARGIN
    if (top + height > window.innerHeight - MARGIN && anchor.top > window.innerHeight - anchor.bottom) {
      top = anchor.top - height - MARGIN
    }
    top = Math.max(MARGIN, top)
    const left = Math.max(MARGIN, Math.min(anchor.left, window.innerWidth - width - MARGIN))
    setPosition({ left, top })
  }, [anchor])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node
      if (triggerRef.current?.contains(target)) return
      if (panelRef.current?.contains(target)) return
      close()
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    window.addEventListener('resize', close)
    window.addEventListener('scroll', close, true)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('resize', close)
      window.removeEventListener('scroll', close, true)
    }
  }, [open])

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        id={id}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => (open ? close() : setAnchor(triggerRef.current!.getBoundingClientRect()))}
        className={`flex w-full items-center gap-2 rounded-lg border bg-surface px-3 py-1.5 text-left text-sm transition disabled:cursor-not-allowed disabled:opacity-60 ${
          invalid ? 'border-critical' : 'border-line-strong'
        } ${selected ? 'text-ink' : 'text-muted'}`}
      >
        <CalendarDays aria-hidden="true" className="size-4 shrink-0" />
        {selected ? format(selected, 'd MMM yyyy') : placeholder}
      </button>
      {open &&
        createPortal(
          <div
            ref={panelRef}
            style={{
              position: 'fixed',
              left: position?.left ?? 0,
              top: position?.top ?? 0,
              visibility: position ? 'visible' : 'hidden',
            }}
            className="z-50 max-h-[70vh] max-w-[min(320px,calc(100vw-2rem))] overflow-y-auto rounded-lg border border-line bg-surface p-2 text-ink shadow-lg [--rdp-accent-background-color:var(--brand-soft)] [--rdp-accent-color:var(--brand-solid)] [--rdp-today-color:var(--brand)]"
          >
            <DayPicker
              mode="single"
              selected={selected}
              defaultMonth={selected ?? maxDate ?? minDate}
              disabled={[
                ...(minDate ? [{ before: minDate }] : []),
                ...(maxDate ? [{ after: maxDate }] : []),
              ]}
              onSelect={(day) => {
                onChange(day ? format(day, DAY_FORMAT) : '')
                close()
              }}
            />
            {value && (
              <button
                type="button"
                onClick={() => {
                  onChange('')
                  close()
                }}
                className="mt-1 w-full rounded-md px-2 py-1 text-left text-xs text-ink-2 hover:bg-hover"
              >
                Clear
              </button>
            )}
          </div>,
          document.body,
        )}
    </>
  )
}
