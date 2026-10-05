import { ValidationError } from '../../../shared/domain/domain.errors'

export const CUSTOMER_STATUSES = ['active', 'inactive', 'churned'] as const
export type CustomerStatus = (typeof CUSTOMER_STATUSES)[number]

export function isCustomerStatus(value: string): value is CustomerStatus {
  return (CUSTOMER_STATUSES as readonly string[]).includes(value)
}

export const SORT_FIELDS = ['name', 'totalAmountSpent', 'totalTransactions', 'lastActivityDate'] as const
export type CustomerSortField = (typeof SORT_FIELDS)[number]

export type SortDirection = 'asc' | 'desc'

export interface ListCustomersQuery {
  readonly search: string
  readonly status: CustomerStatus | 'all'
  readonly country: string
  readonly sort: CustomerSortField
  readonly direction: SortDirection
  readonly page: number
  readonly limit: number
}

/** Aggregate figures shown on the dashboard. */
export interface CustomerKpis {
  readonly totalCustomers: number
  readonly activeCustomers: number
  readonly totalTransactionValue: number
  readonly averageCustomerValue: number
}

export interface CountrySpend {
  readonly country: string
  readonly spend: number
}

export interface ImportFailure {
  readonly row: number
  readonly reason: string
}

export interface ImportSummary {
  readonly imported: number
  readonly skipped: number
  readonly failures: ImportFailure[]
}

/**
 * A customer record.
 *
 * The constructor is the only way to build one, so invariants hold: spend is never
 * negative and a customer always has a transaction count of at least zero.
 */
export class Customer {
  private constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly email: string,
    public readonly country: string,
    public readonly totalTransactions: number,
    public readonly totalAmountSpent: number,
    public readonly lastActivityDate: Date,
    public readonly status: CustomerStatus,
  ) {}

  public static reconstitute(input: {
    id: string
    name: string
    email: string
    country: string
    totalTransactions: number
    totalAmountSpent: number
    lastActivityDate: Date
    status: CustomerStatus
  }): Customer {
    return new Customer(
      input.id,
      input.name,
      input.email,
      input.country,
      input.totalTransactions,
      input.totalAmountSpent,
      input.lastActivityDate,
      input.status,
    )
  }

  /** Validates externally supplied data before it becomes an entity. */
  public static create(input: {
    name: string
    email: string
    country: string
    totalTransactions: number
    totalAmountSpent: number
    lastActivityDate: Date
    status: CustomerStatus
  }): Customer {
    const fieldErrors: Record<string, string[]> = {}
    if (input.name.trim().length === 0) fieldErrors.name = ['A name is required.']
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) {
      fieldErrors.email = ['Enter a valid email address.']
    }
    if (input.country.trim().length < 2) fieldErrors.country = ['A country is required.']
    if (!Number.isInteger(input.totalTransactions) || input.totalTransactions < 0) {
      fieldErrors.totalTransactions = ['Transaction count must be a positive whole number.']
    }
    if (!Number.isFinite(input.totalAmountSpent) || input.totalAmountSpent < 0) {
      fieldErrors.totalAmountSpent = ['Spend must be zero or more.']
    }
    if (Number.isNaN(input.lastActivityDate.getTime())) {
      fieldErrors.lastActivityDate = ['Enter a valid date.']
    }
    if (Object.keys(fieldErrors).length > 0) {
      throw new ValidationError('The customer could not be saved.', fieldErrors)
    }

    return new Customer(
      '',
      input.name.trim(),
      input.email.trim().toLowerCase(),
      input.country.trim(),
      input.totalTransactions,
      Math.round(input.totalAmountSpent * 100) / 100,
      input.lastActivityDate,
      input.status,
    )
  }
}