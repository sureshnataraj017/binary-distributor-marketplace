import {
  ArrowLeftRight,
  IndianRupee,
  LayoutDashboard,
  Moon,
  Network,
  Store,
  Sun,
  Users,
} from 'lucide-react'
import { NavLink, Outlet, matchPath, useLocation } from 'react-router-dom'
import { StateFilter } from '@/components/molecules/StateFilter'
import { useThemeStore } from '@/store/themeStore'

const NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/distributors', label: 'Distributors', icon: Users, end: true },
  { to: '/retailers', label: 'Retailers', icon: Store, end: true },
  { to: '/distributors/network', label: 'Network', icon: Network },
  { to: '/commissions', label: 'Commissions', icon: IndianRupee },
  { to: '/referrals', label: 'Referrals', icon: ArrowLeftRight },
]

/** Pages whose data follows the global state filter. */
const SCOPED_ROUTES = NAV.map((item) => item.to)

const navClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-2.5 whitespace-nowrap rounded-lg border-l-[3px] px-3 py-2 text-sm font-medium transition ${
    isActive
      ? 'border-brand bg-brand-soft text-brand'
      : 'border-transparent text-ink-2 hover:bg-hover hover:text-ink'
  }`

function ThemeToggle() {
  const { theme, toggle } = useThemeStore()
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
      className="rounded-lg border border-line-strong bg-surface px-2.5 py-1.5 text-sm text-ink-2 hover:bg-hover"
    >
      {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  )
}

export function AppLayout() {
  const { pathname } = useLocation()
  const showStateFilter = SCOPED_ROUTES.some((to) => matchPath(to, pathname))

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-2 focus:rounded focus:bg-surface focus:p-2"
      >
        Skip to content
      </a>

      <aside className="border-b border-line bg-surface md:sticky md:top-0 md:h-screen md:w-60 md:shrink-0 md:border-r md:border-b-0 md:shadow-sm">
        <div className="flex items-center gap-2 px-4 py-3 md:py-5">
          <span
            aria-hidden="true"
            className="flex size-8 items-center justify-center rounded-lg bg-linear-to-br from-brand-solid to-brand-2 text-sm font-bold text-white shadow-sm"
          >
            B
          </span>
          <div className="leading-tight">
            <div className="text-sm font-semibold">Binary Marketplace</div>
            <div className="text-xs text-ink-2">Distributor network</div>
          </div>
        </div>
        <nav
          aria-label="Primary"
          className="flex gap-1 overflow-x-auto px-3 pb-2 md:flex-col md:pb-0"
        >
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={navClass}>
              <item.icon aria-hidden="true" className="size-4 shrink-0" />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="sticky top-0 z-20 flex items-center justify-end gap-3 border-b border-line bg-surface/90 px-4 py-2.5 backdrop-blur sm:px-6">
          {showStateFilter && <StateFilter />}
          <ThemeToggle />
        </div>
        <main id="main" className="flex-1 px-4 py-6 sm:px-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
