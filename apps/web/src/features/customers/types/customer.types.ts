import type {
  ActivityTrendPoint as ContractActivityTrendPoint,
  CustomerHealth as ContractCustomerHealth,
  CustomerHealthLevel as ContractCustomerHealthLevel,
  CustomerStatus as ContractCustomerStatus,
  CustomerSortField as ContractSortField,
  CustomerTopList as ContractCustomerTopList,
  TopCustomer as ContractTopCustomer,
} from '@dme/contracts'

/**
 * UI vocabulary for a customer's status.
 *
 * Declared as a const object rather than a TypeScript `enum` so the value type is
 * exactly the union the shared contract uses. That makes the two assignable in
 * both directions, so no cast is needed when crossing the boundary, while
 * `CustomerStatus.ACTIVE` keeps working at every call site.
 */
export const CustomerStatus = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  CHURNED: 'churned',
} as const satisfies Record<string, ContractCustomerStatus>

export type CustomerStatus = ContractCustomerStatus

export interface Customer {
  id: string
  name: string
  email: string
  country: string
  totalTransactions: number
  totalAmountSpent: number
  lastActivityDate: string
  status: CustomerStatus
}

export interface CustomerKPIs {
  totalCustomers: number
  activeCustomers: number
  totalTransactionValue: number
  averageCustomerValue: number
  /** Per-status headcount, the wire source for the status chart. */
  statusCounts: {
    active: number
    inactive: number
    churned: number
  }
}

/** Dashboard-specific aggregates, typed straight off the shared contract. */
export type ActivityTrendPoint = ContractActivityTrendPoint
export type CustomerHealth = ContractCustomerHealth
export type CustomerHealthLevel = ContractCustomerHealthLevel
export type CustomerTopList = ContractCustomerTopList
export type TopCustomer = ContractTopCustomer

export type CustomersFilters = {
  search: string
  status: CustomerStatus | 'all'
  country: string
  page: number
  limit: number
}

export type CustomerSortField = ContractSortField

/** A customer record submitted by the add form or the CSV importer. */
export interface NewCustomerPayload {
  name: string
  email: string
  country: string
  status: CustomerStatus
  totalTransactions: number
  totalAmountSpent: number
  lastActivityDate: string
}

/** Validation failure codes shared by the add form and CSV importer. */
export type CustomerValidationError =
  | 'missingName'
  | 'missingEmail'
  | 'missingCountry'
  | 'badNumber'
  | 'badDate'
  | 'badStatus'
  | 'duplicate'
