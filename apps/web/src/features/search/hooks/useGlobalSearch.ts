import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { searchGlobal } from '@/features/search/api/searchApi'
import { SEARCH_DEBOUNCE_MS, type GlobalSearchResponse } from '@/features/search/types/search.types'

export type SearchStatus = 'idle' | 'loading' | 'success' | 'error'

export interface GlobalSearchState {
  query: string
  setQuery: (value: string) => void
  /** Debounced query — the one the server actually searched for. */
  activeQuery: string
  status: SearchStatus
  response: GlobalSearchResponse | null
  /** Latched response for the still-visible query while a newer one loads. */
  previousResponse: GlobalSearchResponse | null
  error: string | null
  retry: () => void
  clear: () => void
}

/**
 * Debounced, abortable global search.
 *
 * Typing enqueues a run 170ms after the last keystroke; each run aborts the
 * request of the run before it, so results always describe the newest query. The
 * results of the previous run stay visible while the next one is in flight, so
 * the palette never flashes to an empty state between keystrokes — a skeleton
 * row covers that only for brand-new queries.
 */
export function useGlobalSearch(): GlobalSearchState {
  const { t } = useTranslation('common')
  const [query, setQuery] = useState('')
  const [activeQuery, setActiveQuery] = useState('')
  const [status, setStatus] = useState<SearchStatus>('idle')
  const [response, setResponse] = useState<GlobalSearchResponse | null>(null)
  const [previousResponse, setPreviousResponse] = useState<GlobalSearchResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [nonce, setNonce] = useState(0)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    const trim = query.trim()
    const timer = window.setTimeout(() => setActiveQuery(trim), SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [query])

  useEffect(() => {
    abortRef.current?.abort()

    const trimmed = activeQuery
    if (!trimmed) {
      setStatus('idle')
      setResponse(null)
      setPreviousResponse(null)
      setError(null)
      return
    }

    const controller = new AbortController()
    abortRef.current = controller

    setPreviousResponse((current) => current ?? response)
    setStatus('loading')
    setError(null)

    void searchGlobal(trimmed, controller.signal)
      .then((result) => {
        setResponse(result)
        setPreviousResponse(null)
        setStatus('success')
      })
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === 'AbortError') return
        setError(t('topbar.searchError'))
        setStatus('error')
      })

    return () => controller.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeQuery, nonce])

  return {
    query,
    setQuery,
    activeQuery,
    status,
    response,
    previousResponse,
    error,
    retry: () => setNonce((n) => n + 1),
    clear: () => setQuery(''),
  }
}