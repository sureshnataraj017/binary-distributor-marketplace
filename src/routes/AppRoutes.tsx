import { lazy, Suspense } from 'react'
import { Link, Navigate, Route, Routes } from 'react-router-dom'
import { RouteErrorBoundary } from '@/components/common/RouteError'
import { AppLayout } from '@/components/layout/AppLayout'
import { Skeleton } from '@/components/ui/Skeleton'

const Dashboard = lazy(() => import('@/pages/Dashboard'))
const Network = lazy(() => import('@/pages/Network'))
const DistributorDetails = lazy(() => import('@/pages/DistributorDetails'))
const RetailerDetails = lazy(() => import('@/pages/RetailerDetails'))
const RetailerSales = lazy(() => import('@/pages/RetailerSales'))
const CommissionLedger = lazy(() => import('@/pages/CommissionLedger'))
const Referrals = lazy(() => import('@/pages/Referrals'))

function PageFallback() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading page">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-40 w-full" />
    </div>
  )
}

function NotFound() {
  return (
    <div className="mt-16 text-center">
      <p className="text-4xl font-semibold">404</p>
      <p className="mt-1 text-ink-2">That page doesn't exist.</p>
      <Link to="/dashboard" className="mt-3 inline-block text-brand hover:underline">
        Go to dashboard
      </Link>
    </div>
  )
}

export function AppRoutes() {
  return (
    <RouteErrorBoundary>
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/distributors" element={<Navigate to="/distributors/network" replace />} />
            <Route path="/distributors/network" element={<Network />} />
            <Route path="/distributors/:id" element={<DistributorDetails />} />
            <Route path="/retailers/:id" element={<RetailerDetails />} />
            <Route path="/retailers/:id/sales" element={<RetailerSales />} />
            <Route path="/commissions" element={<CommissionLedger />} />
            <Route path="/referrals" element={<Referrals />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </Suspense>
    </RouteErrorBoundary>
  )
}
