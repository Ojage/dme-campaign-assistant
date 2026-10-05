/**
 * Customers API.
 *
 * A thin, typed façade over the shared client. It exists so hooks and components
 * depend on this feature's vocabulary rather than on operation names, and so the
 * enum-to-literal mapping between the UI model and the contract lives in one
 * place.
 */

import { ApiError } from '@dme/contracts/http'
import { apiClient } from '@/lib/api/apiClient'
import {
  CustomerStatus,
  type Customer,
  type CustomerKPIs,
  type CustomersFilters,
  type NewCustomerPayload,
} from '@/features/customers/types/customer.types'
import type { PaginatedResponse } from '@/types/api.types'

export interface ImportOutcomeResult {
  imported: number
  duplicates: number
  failures: Array<{ row: number; reason: string }>
}

/** The list endpoint is server-paginated; `total` drives the pager. */
export async function getCustomers(filters: Partial<CustomersFilters>): Promise<PaginatedResponse<Customer>> {
  const page = await apiClient.call('customers.list', {
    query: {
      search: filters.search ?? '',
      status: filters.status ?? 'all',
      country: filters.country === 'all' ? '' : (filters.country ?? ''),
      sort: 'lastActivityDate',
      direction: 'desc',
      page: filters.page ?? 1,
      limit: filters.limit ?? 10,
    },
  })

  return { items: page.items, total: page.total, page: page.page, limit: page.limit }
}

export function getCustomerKPIs(): Promise<CustomerKPIs> {
  return apiClient.call('customers.kpis')
}

export function getCountries(): Promise<string[]> {
  return apiClient.call('countries.list')
}

export async function addCustomer(input: NewCustomerPayload): Promise<Customer> {
  return apiClient.call('customers.create', { body: input })
}

/**
 * The API validates each row independently, so one malformed line never fails the
 * whole import. Duplicates are reported by the server as skipped rows.
 */
export async function importCustomers(
  inputs: Array<Partial<NewCustomerPayload>>,
): Promise<ImportOutcomeResult> {
  const valid = inputs.map((input) => ({
    name: input.name ?? '',
    email: input.email ?? '',
    country: input.country ?? '',
    status: input.status ?? CustomerStatus.ACTIVE,
    totalTransactions: input.totalTransactions ?? 0,
    totalAmountSpent: input.totalAmountSpent ?? 0,
    lastActivityDate: input.lastActivityDate ?? new Date(0).toISOString(),
  }))

  const result = await apiClient.call('customers.import', { body: { customers: valid } })
  return { imported: result.imported, duplicates: result.skipped, failures: result.failures }
}

/** A duplicate email surfaces as a 409; callers only need to know it happened. */
export function isDuplicateError(error: unknown): boolean {
  return error instanceof ApiError && error.code === 'conflict'
}

