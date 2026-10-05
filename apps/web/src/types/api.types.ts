import type { CustomerPage } from '@dme/contracts'

/** Envelope returned by paginated list endpoints, as declared in the contract. */
export type PaginatedResponse<T> = CustomerPage & { items: T[] }
