import {
  ArrowLeftRight,
  Briefcase,
  Building2,
  IndianRupee,
  ShoppingBag,
  Store,
  Target,
  Users,
  Wallet,
} from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { CommissionMix } from '@/components/features/CommissionMix'
import { SalesChart } from '@/components/features/SalesChart'
import { DashboardCard } from '@/components/common/DashboardCard'
import { ErrorState } from '@/components/common/ErrorState'
import { PageHeader } from '@/components/common/PageHeader'
import { ProgressRing } from '@/components/common/ProgressRing'
import { Card } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { defaultCommissionConfig } from '@/config/commissionConfig'
import { salesByDay } from '@/domain/metrics'
import { useMarketplaceData } from '@/hooks/useMarketplaceData'
import { formatCurrency } from '@/utils/currencyFormatter'

const { sale: rates, referralPercentage } = defaultCommissionConfig

export default function Dashboard() {
  const { all, data, metrics, summaries, now, selectedState, isScoped, isLoading, error, refetch } =
    useMarketplaceData()
  const isEmptyDatabase = !!all && all.distributors.length === 0

  const daily = useMemo(
    () => (data ? salesByDay(data.sales, { now, config: defaultCommissionConfig }) : []),
    [data, now],
  )

  const leaders = useMemo(
    () =>
      [...(summaries?.values() ?? [])]
        .filter((s) => s.progress.completed > 0)
        .sort((a, b) => b.progress.completed - a.progress.completed || b.totalSales - a.totalSales)
        .slice(0, 6),
    [summaries],
  )
  const nameById = useMemo(
    () => new Map((data?.distributors ?? []).map((d) => [d.id, d.name])),
    [data],
  )

  if (error) {
    return (
      <>
        <PageHeader title="Dashboard" />
        <Card>
          <ErrorState error={error} onRetry={refetch} />
        </Card>
      </>
    )
  }

  const loading = isLoading || !metrics
  const onboarding = metrics?.onboarding

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={isScoped ? `Showing ${selectedState} only` : 'Network-wide overview'}
      />

      {isEmptyDatabase && (
        <Card className="mb-4 border-brand p-5">
          <h2 className="font-semibold">Welcome. There's no data yet.</h2>
          <p className="mt-1 text-sm text-ink-2">
            Everything here is entered one record at a time and stored in PostgreSQL. Start with the
            first distributor, then onboard retailers under them and record their sales.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              to="/distributors"
              className="rounded-lg bg-linear-to-r from-brand-solid to-brand-2 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:shadow-md hover:brightness-105"
            >
              Add your first distributor
            </Link>
            <Link
              to="/retailers"
              className="rounded-lg border border-line-strong bg-surface px-3 py-1.5 text-sm font-medium hover:bg-hover"
            >
              Retailers
            </Link>
          </div>
        </Card>
      )}

      <section aria-label="Key metrics" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <DashboardCard
          label="Total distributors"
          value={metrics?.totalDistributors}
          icon={Users}
          loading={loading}
        />
        <DashboardCard
          label="Total retailers"
          value={metrics?.totalRetailers}
          hint="Active retailers"
          icon={Store}
          loading={loading}
        />
        <DashboardCard
          label="Today's sales"
          value={metrics && formatCurrency(metrics.todaysSales)}
          icon={IndianRupee}
          loading={loading}
        />
        <DashboardCard
          label="Total commissions"
          value={metrics && formatCurrency(metrics.totalCommissions)}
          hint="Distributor + retailer + referral + company"
          icon={Wallet}
          loading={loading}
        />

        <DashboardCard
          label="Today's onboarding achievement"
          value={onboarding && `${onboarding.completed} / ${onboarding.target}`}
          hint={
            onboarding &&
            `${onboarding.remaining} remaining · ${formatCurrency(onboarding.bonus)} bonus today`
          }
          icon={Target}
          loading={loading}
        >
          {onboarding && (
            <div className="mt-2 flex items-center gap-3">
              <ProgressRing percent={onboarding.achievementPct} label="Onboarding achievement" />
              <p className="text-xs text-ink-2">
                of the network's daily target of {onboarding.target} onboardings
              </p>
            </div>
          )}
        </DashboardCard>

        <DashboardCard
          label="Distributor commissions"
          accent="series-1"
          value={metrics && formatCurrency(metrics.distributorCommissions)}
          hint={`${rates.distributorPercentage}% of sales + onboarding bonuses`}
          icon={Briefcase}
          loading={loading}
        />
        <DashboardCard
          label="Retailer commissions"
          accent="series-2"
          value={metrics && formatCurrency(metrics.retailerCommissions)}
          hint={`${rates.retailerPercentage}% of retailer sales`}
          icon={ShoppingBag}
          loading={loading}
        />
        <DashboardCard
          label="Referral commissions"
          accent="series-3"
          value={metrics && formatCurrency(metrics.referralCommissions)}
          hint={`${referralPercentage}% of referred distributor fees`}
          icon={ArrowLeftRight}
          loading={loading}
        />
        <DashboardCard
          label="Company downline commission"
          accent="series-4"
          value={metrics && formatCurrency(metrics.companyCommission)}
          hint={`${rates.companyPercentage}% of downline sales`}
          icon={Building2}
          loading={loading}
        />
      </section>

      <div className="mt-6 grid gap-4 lg:grid-cols-5">
        <Card className="p-4 transition-shadow duration-200 hover:shadow-md lg:col-span-3">
          <h2 className="font-semibold">Sales, last 14 days</h2>
          <p className="mb-3 text-xs text-ink-2">Daily totals in the business time zone (IST)</p>
          {loading ? <Skeleton className="h-56 w-full" /> : <SalesChart data={daily} />}
        </Card>

        <Card className="p-4 transition-shadow duration-200 hover:shadow-md lg:col-span-2">
          <h2 className="font-semibold">Where commissions go</h2>
          <p className="mb-4 text-xs text-ink-2">Share of total commissions by stream</p>
          {loading || !metrics ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <CommissionMix metrics={metrics} />
          )}
        </Card>
      </div>

      <Card className="mt-4 p-4 transition-shadow duration-200 hover:shadow-md">
        <h2 className="font-semibold">Today's onboarding leaders</h2>
        <p className="mb-3 text-xs text-ink-2">Qualifying retailers onboarded today</p>
        {loading ? (
          <Skeleton className="h-24 w-full" />
        ) : leaders.length === 0 ? (
          <p className="py-4 text-sm text-ink-2">No qualifying onboardings yet today.</p>
        ) : (
          <ul className="divide-y divide-line">
            {leaders.map((s, i) => (
              <li
                key={s.distributorId}
                className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-hover"
              >
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[11px] font-semibold text-brand">
                  {i + 1}
                </span>
                <ProgressRing
                  percent={s.progress.achievementPct}
                  size={44}
                  label={`${s.distributorId} achievement`}
                />
                <div className="min-w-0 flex-1">
                  <Link
                    to={`/distributors/${s.distributorId}`}
                    className="font-medium text-brand hover:underline"
                  >
                    {nameById.get(s.distributorId)}{' '}
                    <span className="text-ink-2">({s.distributorId})</span>
                  </Link>
                  <p className="text-xs text-ink-2">
                    {s.progress.completed} of {s.progress.target} onboarded · {s.progress.remaining}{' '}
                    remaining
                  </p>
                </div>
                <div className="text-right text-sm font-medium tabular-nums">
                  {formatCurrency(s.progress.bonus)}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  )
}
