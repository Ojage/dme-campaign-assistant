import { useCallback } from 'react'
import { keepPreviousData, useQueries } from '@tanstack/react-query'
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

/** One card's view of its query: data plus the loading and error it owns. */
export interface DashboardSlice<T> {
  data: T
  isLoading: boolean
  error: string | null
}

function sliceOf<T>(data: T, isLoading: boolean, error: unknown | null): DashboardSlice<T> {
  return { data, isLoading, error: error instanceof Error ? error.message : null }
}

export interface DashboardData {
  kpis: DashboardSlice<CustomerKPIs | null>
  spendByCountry: DashboardSlice<Array<{ country: string; spend: number }>>
  revenueTrend: DashboardSlice<ActivityTrendPoint[]>
  health: DashboardSlice<CustomerHealth | null>
  topCustomers: DashboardSlice<CustomerTopList['items']>
  topTotalValue: number
  segmentsSummary: DashboardSlice<{ count: number; totalAudience: number; averageAudience: number } | null>
  /** Any card still loading; used for page-level skeletons that replace nothing. */
  isLoading: boolean
  reload: () => void
}

/**
 * Dashboard aggregates.
 *
 * Every card reads the same cache the customers and segments pages fill, so a
 * write there (import, save a segment) updates the dashboard without this hook
 * knowing that a write happened. The trend horizon is a query parameter, so
 * flipping the 6/12-month toggle issues a new keyed query rather than a refetch;
 * `keepPreviousData` keeps the old horizon on screen while the new one loads.
 *
 * Each card gets its own slice so a failing aggregate (say, a flaky LLM health
 * endpoint) shows a per-card error instead of hiding the whole dashboard.
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
        placeholderData: keepPreviousData,
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

  return {
    kpis: sliceOf(kpisQuery.data ?? null, kpisQuery.isPending, kpisQuery.error),
    spendByCountry: sliceOf(spendQuery.data ?? [], spendQuery.isPending, spendQuery.error),
    revenueTrend: sliceOf(trendQuery.data ?? [], trendQuery.isPending, trendQuery.error),
    health: sliceOf(healthQuery.data ?? null, healthQuery.isPending, healthQuery.error),
    topCustomers: sliceOf(topQuery.data?.items ?? [], topQuery.isPending, topQuery.error),
    topTotalValue: topQuery.data?.totalValue ?? 0,
    segmentsSummary: sliceOf(segmentsQuery.data ?? null, segmentsQuery.isPending, segmentsQuery.error),
    isLoading: queries.some((query) => query.isPending),
    reload,
  }
}