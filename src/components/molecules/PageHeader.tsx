import { ArrowLeft, ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

interface Crumb {
  label: string
  to?: string
}

export function PageHeader({
  title,
  description,
  crumbs,
  actions,
}: {
  title: ReactNode
  description?: ReactNode
  crumbs?: Crumb[]
  actions?: ReactNode
}) {
  // The nearest ancestor in the trail is the natural "back" target (the final crumb is this page itself).
  const backTo = [...(crumbs ?? []).slice(0, -1)].reverse().find((c) => c.to)?.to

  return (
    <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        {backTo && (
          <Link
            to={backTo}
            className="mb-1 inline-flex items-center gap-1 text-sm font-medium text-ink-2 hover:text-ink"
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            Back
          </Link>
        )}
        {crumbs && (
          <nav
            aria-label="Breadcrumb"
            className="mb-1 flex flex-wrap items-center gap-1 text-sm text-ink-2"
          >
            {crumbs.map((crumb, i) => (
              <span key={`${crumb.label}-${i}`} className="flex items-center gap-1">
                {i > 0 && <ChevronRight aria-hidden="true" className="size-3.5" />}
                {crumb.to ? (
                  <Link to={crumb.to} className="text-brand hover:underline">
                    {crumb.label}
                  </Link>
                ) : (
                  <span>{crumb.label}</span>
                )}
              </span>
            ))}
          </nav>
        )}
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-ink-2">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  )
}
