import { useCallback } from 'react'
import { useQueries } from '@tanstack/react-query'
import {
  getActivityTrend,
  getCustomerHealth,
  getCustomerKPIs,
  getTopCustomers,
} from '@/features/customers/api/customersApi'
import { getSegmentSummary } from '@/features/segments/api/segmentsApi'
import { apiClient } from '@/lib/api/apiClient'
import { queryKeys } from '@/lib/query/queryKeys'
import type {
  ActivityTrendPoint,
  CustomerHealth,
  CustomerKPIs,
  CustomerTopList,
} from '@/features/customers/types/customer.types'

export interface DashboardData {
  kpis: CustomerKPIs | null
  spendByCountry: Array<{ country: string; spend: number }>
  revenueTrend: ActivityTrendPoint[]
  health: CustomerHealth | null
  topCustomers: CustomerTopList['items']
  topTotalValue: number
  segmentsSummary: { count: number; totalAudience: number; averageAudience: number } | null
  isLoading: boolean
  error: string | null
  reload: () => void
}

/**
 * Dashboard aggregates.
 *
 * Every card reads the same cache the customers and segments pages fill, so a
 * write there (import, save a segment) updates the dashboard without this hook
 * knowing that a write happened. The trend horizon is a query parameter, so
 * flipping the 6/12-month toggle issues a new keyed query rather than a refetch.
 */
export function useDashboard(months: number): DashboardData {
  const queries = useQueries({
    queries: [
      { queryKey: queryKeys.customers.kpis, queryFn: getCustomerKPIs },
      {
        queryKey: queryKeys.customers.countrySpend,
        queryFn: () => apiClient.call('countries.spend'),
      },
      {
        queryKey: queryKeys.customers.activityTrend(months),
        queryFn: () => getActivityTrend(months),
      },
      { queryKey: queryKeys.customers.health, queryFn: getCustomerHealth },
      { queryKey: queryKeys.customers.top, queryFn: () => getTopCustomers(5) },
      { queryKey: queryKeys.segments.summary, queryFn: getSegmentSummary },
    ],
  })

  const [kpisQuery, spendQuery, trendQuery, healthQuery, topQuery, segmentsQuery] = queries

  const reload = useCallback(() => {
    for (const query of queries) void query.refetch()
    // `queries` is a fresh array every render; the callback closes over the
    // current one, which is fine because refetch always targets the cache.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const failure = queries.find((query) => query.error instanceof Error)?.error

  return {
    kpis: kpisQuery.data ?? null,
    spendByCountry: spendQuery.data ?? [],
    revenueTrend: trendQuery.data ?? [],
    health: healthQuery.data ?? null,
    topCustomers: topQuery.data?.items ?? [],
    topTotalValue: topQuery.data?.totalValue ?? 0,
    segmentsSummary: segmentsQuery.data ?? null,
    isLoading: queries.some((query) => query.isPending),
    error: failure instanceof Error ? failure.message : null,
    reload,
  }
}