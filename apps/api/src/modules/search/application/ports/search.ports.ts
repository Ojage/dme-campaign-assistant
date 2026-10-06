import type { GlobalSearchQuery, SearchHit } from '../../domain/search.types'

/**
 * Driven port for the cross-entity search index. The adapter owns the ranking,
 * so the use case never sees SQL or the shape of a table row.
 */
export interface SearchRepository {
  /**
   * Returns hits across customers, segments and campaigns, limited to `limit`
   * entries per table and then ranked, so the caller gets the strongest mix in
   * one call without loading three full tables.
   */
  search(query: GlobalSearchQuery): Promise<SearchHit[]>
}

export const SEARCH_PORTS = {
  repository: Symbol('SEARCH.repository'),
} as const