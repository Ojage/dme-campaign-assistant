import { useRef, type ReactNode } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { RoutePath } from '@/app/router/RoutePaths'
import { AuthBootScreen } from '@/features/auth/components/AuthBootScreen'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { useAuthStore } from '@/stores/authStore'
import type { AuthStatus } from '@/features/auth/types/auth.types'

/** Where the user tried to go before the session was checked. */
interface RedirectState {
  from?: string
}

/**
 * Gate for every authenticated route.
 *
 * While the stored session is being restored it renders a boot frame rather than
 * redirecting, so refreshing an authenticated session never flashes /login. The
 * attempted path rides along in router state and the login page returns to it.
 */
export function RequireAuth() {
  const { status } = useAuth()
  // Subscribed, not read through getState(): hydration must trigger a re-render.
  const hydrated = useAuthStore((state) => state.hydrated)
  const location = useLocation()

  if (status === 'loading' || !hydrated) return <AuthBootScreen />
  if (status === 'anonymous') {
    // Keep the query string (search filters, ?focus deep links) so the login
    // redirect drops only the navigation, not the user's context.
    const from = location.pathname + location.search
    return <Navigate to={RoutePath.LOGIN} replace state={{ from }} />
  }
  return <Outlet />
}

/**
 * Keeps signed-in users off /login, and owns the post-sign-in redirect.
 *
 * Navigating from the login form itself would race the auth state commit: the
 * router can move to the deep-linked path while the provider still reports
 * `anonymous`, and RequireAuth would bounce straight back to /login. Deriving the
 * destination from state instead means the redirect happens on the render where
 * the session is actually live.
 */
export function PublicOnly({ children }: { children: ReactNode }) {
  const { status } = useAuth()
  const hydrated = useAuthStore((state) => state.hydrated)
  const location = useLocation()
  const settledStatus = useRef<AuthStatus | null>(null)

  if (hydrated && status !== 'loading' && settledStatus.current === null) settledStatus.current = status

  if (settledStatus.current === null) return <AuthBootScreen />

  if (status === 'authenticated') {
    const from = (location.state as RedirectState | null)?.from
    const destination = settledStatus.current === 'authenticated' ? RoutePath.ROOT : (from ?? RoutePath.ROOT)
    return <Navigate to={destination} replace />
  }

  return <>{children}</>
}