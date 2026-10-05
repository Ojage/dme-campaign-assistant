import { useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getCustomerKPIs } from '@/features/customers/api/customersApi'
import { queryKeys } from '@/lib/query/queryKeys'

/**
 * KPI aggregates for the customers header.
 *
 * Reads the query cache, so an import or an add invalidates it like any other
 * customer write instead of needing a hand-rolled refresh event.
 */
export function useCustomerKPIs() {
  const query = useQuery({
    queryKey: queryKeys.customers.kpis,
    queryFn: getCustomerKPIs,
  })

  const reload = useCallback(() => void query.refetch(), [query])

  return {
    kpis: query.data ?? null,
    isLoading: query.isPending,
    error: query.error instanceof Error ? query.error.message : null,
    reload,
  }
}
