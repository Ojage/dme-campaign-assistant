/** Front-end mirror of the search contract. */
export type SearchType = 'customer' | 'segment' | 'campaign'

export interface SearchHit {
  type: SearchType
  id: string
  title: string
  subtitle: string | null
  /** Badge text: a status, a channel, an audience count. */
  meta: string | null
  score: number
}

export interface GlobalSearchResponse {
  query: string
  total: number
  tookMs: number
  results: SearchHit[]
}

export const SEARCH_TYPES: readonly SearchType[] = ['customer', 'segment', 'campaign'] as const

export const SEARCH_LIMIT = 8
export const SEARCH_DEBOUNCE_MS = 170