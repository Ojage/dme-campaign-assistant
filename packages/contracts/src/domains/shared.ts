import * as z from 'zod/v4'

/** ISO-8601 instant, always serialised with a timezone offset. */
export const isoDateTimeSchema = z.string().min(1)

/** Opaque identifier minted by the API. UUIDs in production. */
export const idSchema = z.string().min(1)

/** 1-based page index. */
export const pageSchema = z.coerce.number().int().min(1)
export const limitSchema = z.coerce.number().int().min(1).max(200)

export const paginationQuerySchema = z.object({
  page: pageSchema.default(1),
  limit: limitSchema.default(50),
})

export type PaginationQuery = z.infer<typeof paginationQuerySchema>

/** Envelope used by every paginated collection endpoint. */
export interface Page<TItem> {
  items: TItem[]
  total: number
  page: number
  limit: number
}

export function pageOf<TItem>(items: TItem[], total: number, query: PaginationQuery): Page<TItem> {
  return { items, total, page: query.page, limit: query.limit }
}

/** A currency amount rounded to two decimals, expressed in minor-unit-safe numbers. */
export const amountSchema = z.number().finite().min(0)