/**
 * Pure types for the cross-entity search, shared by the port, the use case and
 * the TypeORM adapter.
 */

export type SearchHitType = 'customer' | 'segment' | 'campaign'

export interface GlobalSearchQuery {
  q: string
  limit: number
}

export interface SearchHit {
  type: SearchHitType
  id: string
  title: string
  subtitle: string | null
  /** Short badge text: a status, a channel, an audience count. */
  meta: string | null
  /** Relevance rank. Higher is closer. Never an SQL value — it is a score. */
  score: number
}

export interface GlobalSearchResult {
  query: string
  total: number
  tookMs: number
  results: SearchHit[]
}