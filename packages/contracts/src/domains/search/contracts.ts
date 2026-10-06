import * as z from 'zod/v4'
import { idSchema } from '../shared.js'

/**
 * What kind of record a hit is. The palette groups results by this value, so it
 * is part of the contract rather than an implementation detail.
 */
export const searchResultTypeSchema = z.enum(['customer', 'segment', 'campaign'])
export type SearchResultType = z.infer<typeof searchResultTypeSchema>

/**
 * One hit. `title` is always the primary, most specific field for that record
 * type (a customer name, a segment name, a campaign title); `subtitle` is the
 * natural secondary line (email, an audience description, the segment the
 * campaign targets). `meta` is a short label the palette can render as a badge
 * so rows convey more than a bare string.
 */
export const searchResultSchema = z.object({
  type: searchResultTypeSchema,
  id: idSchema,
  title: z.string().min(1),
  subtitle: z.string().nullable(),
  meta: z.string().nullable(),
  /** Relevance rank, higher is a closer match. The client sorts by it. */
  score: z.number().nonnegative(),
})
export type SearchResult = z.infer<typeof searchResultSchema>

/** A palette is compact, so the page size cap is far below a list page's. */
export const searchLimitSchema = z.coerce.number().int().min(1).max(24)

export const searchQuerySchema = z.object({
  q: z.string().trim().min(1).max(120),
  limit: searchLimitSchema.default(8),
})
export type SearchQuery = z.infer<typeof searchQuerySchema>

export const searchResponseSchema = z.object({
  query: z.string().min(1),
  total: z.number().int().min(0),
  /** Milliseconds of server-side work, surfaced so the palette can show latency. */
  tookMs: z.number().int().min(0),
  results: z.array(searchResultSchema),
})
export type SearchResponse = z.infer<typeof searchResponseSchema>