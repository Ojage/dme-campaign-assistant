import type {
  ActivityTrendPoint,
  CountrySpend,
  Customer,
  CustomerHealthInput,
  CustomerKpis,
  CustomerStatus,
  ListCustomersQuery,
  TopCustomer,
} from '../../domain/customer.entity'

/** Driven port for customer storage. */
export interface CustomerRepository {
  /** Returns the page plus the unpaginated total for the same filter. */
  list(query: ListCustomersQuery): Promise<{ items: Customer[]; total: number }>
  findByEmail(email: string): Promise<Customer | null>
  create(customer: Customer): Promise<Customer>
  /**
   * Inserts many rows in one round trip and reports which emails already existed.
   * Returns the stored customers and the duplicate emails that were skipped.
   */
  createMany(customers: Customer[]): Promise<{ stored: Customer[]; duplicates: string[] }>
  kpis(): Promise<CustomerKpis>
  countries(): Promise<string[]>
  spendByCountry(): Promise<CountrySpend[]>
  countByStatus(status: CustomerStatus): Promise<number>
  /** Trailing-month activity series, ascending by month. */
  activityTrend(months: number): Promise<ActivityTrendPoint[]>
  /** Headcounts used to build the composite health report. */
  healthCounts(): Promise<CustomerHealthInput>
  /** Highest-value customers, descending, plus the whole base's lifetime value. */
  top(limit: number): Promise<{ items: TopCustomer[]; totalValue: number }>
}

export const CUSTOMER_PORTS = {
  repository: Symbol('CUSTOMER.repository'),
} as const