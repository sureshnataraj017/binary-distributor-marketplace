import { Check, Clock, X } from 'lucide-react'
import type { ComponentType, ReactNode } from 'react'

export type BadgeTone = 'neutral' | 'good' | 'warn' | 'critical' | 'brand'

const TONES: Record<BadgeTone, string> = {
  neutral: 'bg-hover text-ink-2',
  good: 'bg-good-soft text-good',
  warn: 'bg-warn-soft text-warn',
  critical: 'bg-critical-soft text-critical',
  brand: 'bg-brand-soft text-brand',
}

const ICONS: Partial<Record<BadgeTone, ComponentType<{ className?: string }>>> = {
  good: Check,
  warn: Clock,
  critical: X,
}

/** Status colours never carry meaning alone: a glyph and a text label always accompany them. */
export function Badge({ tone = 'neutral', children }: { tone?: BadgeTone; children: ReactNode }) {
  const Icon = ICONS[tone]
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${TONES[tone]}`}
    >
      {Icon && <Icon aria-hidden="true" className="size-3" />}
      {children}
    </span>
  )
}
