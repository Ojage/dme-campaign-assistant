import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { ApiError } from '@dme/contracts/http'

/**
 * Server-state provider.
 *
 * One client for the app, created inside component state so React's StrictMode
 * double-mount does not throw away the cache. The defaults are tuned for a
 * workspace dashboard: refetching on focus keeps figures current, and retries
 * are skipped for 4xx because repeating a rejected request cannot help.
 */
export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: true,
            retry: (failureCount, error) => {
              if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false
              return failureCount < 2
            },
          },
          mutations: {
            retry: false,
          },
        },
      }),
  )

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
