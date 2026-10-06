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
  readonly statusCounts: {
    readonly active: number
    readonly inactive: number
    readonly churned: number
  }
}

/** One month bucket of customer activity, keyed by the month of `lastActivityDate`. */
export interface ActivityTrendPoint {
  readonly month: string
  readonly value: number
  readonly customers: number
  readonly churned: number
}

/**
 * Raw headcounts that feed `computeCustomerHealth`, kept separate from the
 * derived report so the pure function stays trivial to test.
 */
export interface CustomerHealthInput {
  readonly total: number
  readonly active: number
  readonly inactive: number
  readonly churned: number
  /** Still-active accounts whose last activity predates the staleness window. */
  readonly staleActives: number
}

export type CustomerHealthLevel = 'healthy' | 'attention' | 'critical'

export interface CustomerHealth {
  readonly score: number
  readonly level: CustomerHealthLevel
  readonly activeShare: number
  readonly churnedShare: number
  readonly inactiveCount: number
  readonly staleActives: number
}

export const STALE_ACTIVITY_DAYS = 60

/**
 * Collapses the customer base into a single 0-100 score.
 *
 * Start from a perfect 100 and subtract a share of every symptom; the weights are
 * documented by what they push a *pure* base to:
 *   - all active and freshly engaged  -> 100 (`healthy`)
 *   - all inactive                    -> 50  (`attention`)
 *   - all stale (active but dormant)  -> 30  (`critical`)
 *   - all churned                     -> 20  (`critical`)
 * An empty base has no signal either way and is reported as `critical` with a
 * score of 0 so the UI treats it as "nothing to show" rather than pretending
 * the base is healthy.
 */
export function computeCustomerHealth(input: CustomerHealthInput): CustomerHealth {
  const { total, active, inactive, churned, staleActives } = input
  if (total <= 0) {
    return { score: 0, level: 'critical', activeShare: 0, churnedShare: 0, inactiveCount: 0, staleActives: 0 }
  }

  const round1 = (n: number) => Math.round(n * 10) / 10
  const activeShare = round1((active / total) * 100)
  const churnedShare = round1((churned / total) * 100)
  const churnedPct = (churned / total) * 100
  const inactivePct = (inactive / total) * 100
  const stalePct = (staleActives / total) * 100
  const score = Math.max(0, Math.min(100, Math.round(100 - churnedPct * 0.8 - inactivePct * 0.5 - stalePct * 0.7)))
  const level: CustomerHealthLevel = score >= 60 ? 'healthy' : score >= 40 ? 'attention' : 'critical'

  return { score, level, activeShare, churnedShare, inactiveCount: inactive, staleActives }
}

/** A highest-value customer for the dashboard leaderboard. */
export interface TopCustomer {
  readonly id: string
  readonly name: string
  readonly country: string
  readonly status: CustomerStatus
  readonly totalAmountSpent: number
  readonly totalTransactions: number
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