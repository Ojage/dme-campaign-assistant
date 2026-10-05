import { useCallback } from 'react'
import { useQueries } from '@tanstack/react-query'
import { getCustomerKPIs } from '@/features/customers/api/customersApi'
import { apiClient } from '@/lib/api/apiClient'
import { queryKeys } from '@/lib/query/queryKeys'
import { REVENUE_TREND, type RevenueTrendPoint } from '@/features/dashboard/data/revenueTrend'
import type { CustomerKPIs } from '@/features/customers/types/customer.types'

export interface DashboardData {
  kpis: CustomerKPIs | null
  spendByCountry: Array<{ country: string; spend: number }>
  revenueTrend: RevenueTrendPoint[]
}

/**
 * Dashboard aggregates.
 *
 * Both reads are queries, so the dashboard renders from the same cache the
 * customers page fills: importing customers updates the KPIs here without this
 * hook knowing that a write happened. The trend series is still derived from the
 * seeded fixture because no endpoint produces it yet.
 */
export function useDashboard() {
  const [kpisQuery, spendQuery] = useQueries({
    queries: [
      { queryKey: queryKeys.customers.kpis, queryFn: getCustomerKPIs },
      {
        queryKey: queryKeys.customers.countrySpend,
        queryFn: () => apiClient.call('countries.spend'),
      },
    ],
  })

  const reload = useCallback(() => {
    void kpisQuery.refetch()
    void spendQuery.refetch()
  }, [kpisQuery, spendQuery])

  const failure = [kpisQuery.error, spendQuery.error].find((error) => error instanceof Error)

  return {
    kpis: kpisQuery.data ?? null,
    spendByCountry: spendQuery.data ?? [],
    revenueTrend: REVENUE_TREND,
    isLoading: kpisQuery.isPending || spendQuery.isPending,
    error: failure instanceof Error ? failure.message : null,
    reload,
  }
}
