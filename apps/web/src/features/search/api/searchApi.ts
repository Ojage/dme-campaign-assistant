import { apiClient } from '@/lib/api/apiClient'
import { SEARCH_LIMIT, type GlobalSearchResponse } from '@/features/search/types/search.types'

/**
 * Global fuzzy search across customers, segments and campaigns.
 *
 * The shared client accepts an `AbortSignal`, so the console abandons stale
 * queries as the user keeps typing instead of letting an old reply overwrite a
 * newer one.
 */
export function searchGlobal(q: string, signal?: AbortSignal): Promise<GlobalSearchResponse> {
  return apiClient.call('search.global', { query: { q, limit: SEARCH_LIMIT }, signal })
}