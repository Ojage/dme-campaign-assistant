import { Suspense, lazy, type ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { PageSkeleton } from '@/components/common/PageSkeleton'
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
 * Route table. Every path comes from RoutePath — no inline strings.
 * The authenticated tree sits behind RequireAuth; /login is PublicOnly.
 */
export function AppRouter() {
  return (
    <Routes>
      <Route
        path={RoutePath.LOGIN}
        element={
          <PublicOnly>
            {withSuspense(<LoginPage />)}
          </PublicOnly>
        }
      />

      <Route element={<RequireAuth />}>
        <Route path={RoutePath.ROOT} element={<AppLayout />}>
          <Route index element={<Navigate to={RoutePath.DASHBOARD} replace />} />
          <Route path={RoutePath.DASHBOARD} element={withSuspense(<DashboardPage />)} />
          <Route path={RoutePath.CUSTOMERS} element={withSuspense(<CustomersPage />)} />
          <Route path={RoutePath.SEGMENTS} element={withSuspense(<SegmentsPage />)} />
          <Route path={RoutePath.CAMPAIGNS} element={withSuspense(<CampaignsPage />)} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to={RoutePath.ROOT} replace />} />
    </Routes>
  )
}
