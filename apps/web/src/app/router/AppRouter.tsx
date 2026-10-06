import { Suspense, lazy, type ReactNode } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { PageSkeleton } from '@/components/common/PageSkeleton'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { RoutePath } from '@/app/router/RoutePaths'
import { PublicOnly, RequireAuth } from '@/app/router/RouteGuard'

const LoginPage = lazy(() => import('@/pages/LoginPage'))
const DashboardPage = lazy(() => import('@/pages/DashboardPage'))
const CustomersPage = lazy(() => import('@/pages/CustomersPage'))
const SegmentsPage = lazy(() => import('@/pages/SegmentsPage'))
const CampaignsPage = lazy(() => import('@/pages/CampaignsPage'))

function withSuspense(element: ReactNode) {
  return <Suspense fallback={<PageSkeleton />}>{element}</Suspense>
}

/**
 * Isolates a crashed page under the boundary for this route. Keyed by the
 * current path so navigating away (or back) resets the boundary — the React
 * docs' prescribed way to recover from the outside.
 */
function withBoundary(element: ReactNode, layout: 'root' | 'content', path: string) {
  return (
    <ErrorBoundary key={path} layout={layout}>
      {withSuspense(element)}
    </ErrorBoundary>
  )
}

/**
 * Route table. Every path comes from RoutePath — no inline strings.
 * The authenticated tree sits behind RequireAuth; /login is PublicOnly.
 */
export function AppRouter() {
  const location = useLocation()

  return (
    <Routes>
      <Route
        path={RoutePath.LOGIN}
        element={
          <PublicOnly>{withBoundary(<LoginPage />, 'root', location.pathname)}</PublicOnly>
        }
      />

      <Route element={<RequireAuth />}>
        <Route path={RoutePath.ROOT} element={<AppLayout />}>
          <Route index element={<Navigate to={RoutePath.DASHBOARD} replace />} />
          <Route
            path={RoutePath.DASHBOARD}
            element={withBoundary(<DashboardPage />, 'content', location.pathname)}
          />
          <Route
            path={RoutePath.CUSTOMERS}
            element={withBoundary(<CustomersPage />, 'content', location.pathname)}
          />
          <Route
            path={RoutePath.SEGMENTS}
            element={withBoundary(<SegmentsPage />, 'content', location.pathname)}
          />
          <Route
            path={RoutePath.CAMPAIGNS}
            element={withBoundary(<CampaignsPage />, 'content', location.pathname)}
          />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to={RoutePath.ROOT} replace />} />
    </Routes>
  )
}
