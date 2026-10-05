import { useCallback, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import type { Customer, CustomersFilters } from '@/features/customers/types/customer.types'
import { CustomerStatus } from '@/features/customers/types/customer.types'
import { getCustomers } from '@/features/customers/api/customersApi'
import { useDebounce } from '@/hooks/useDebounce'
import { queryKeys } from '@/lib/query/queryKeys'

const DEFAULT_FILTERS: CustomersFilters = {
  search: '',
  status: 'all',
  country: 'all',
  page: 1,
  limit: 10,
}

export const PAGE_SIZE_OPTIONS = [10, 20, 50]

/**
 * Customers list: filter state lives here, the rows live in the query cache.
 *
 * Two consumers of this data (the table and the dashboard) share one cache entry
 * per filter combination, so switching pages back and forth is instant and a write
 * anywhere refreshes both. `keepPreviousData` keeps the table populated while the
 * next page loads instead of flashing a skeleton.
 */
export function useCustomers() {
  const [filters, setFilters] = useState<CustomersFilters>(DEFAULT_FILTERS)
  const debouncedSearch = useDebounce(filters.search, 400)

  const query = useQuery({
    queryKey: queryKeys.customers.list({ ...filters, search: debouncedSearch }),
    queryFn: () => getCustomers({ ...filters, search: debouncedSearch }),
    placeholderData: keepPreviousData,
  })

  const retry = useCallback(() => void query.refetch(), [query])

  const handleSearchChange = useCallback((search: string) => {
    setFilters((prev) => ({ ...prev, search, page: 1 }))
  }, [])

  const handleStatusChange = useCallback((status: CustomerStatus | 'all') => {
    setFilters((prev) => ({ ...prev, status, page: 1 }))
  }, [])

  const handleCountryChange = useCallback((country: string) => {
    setFilters((prev) => ({ ...prev, country, page: 1 }))
  }, [])

  const handlePageChange = useCallback((page: number) => {
    setFilters((prev) => ({ ...prev, page }))
  }, [])

  const handlePageSizeChange = useCallback((limit: number) => {
    setFilters((prev) => ({ ...prev, limit, page: 1 }))
  }, [])

  return {
    customers: query.data?.items ?? ([] as Customer[]),
    total: query.data?.total ?? 0,
    filters,
    isLoading: query.isPending,
    isFetching: query.isFetching,
    error: query.error instanceof Error ? query.error.message : null,
    retry,
    handleSearchChange,
    handleStatusChange,
    handleCountryChange,
    handlePageChange,
    handlePageSizeChange,
  }
}
