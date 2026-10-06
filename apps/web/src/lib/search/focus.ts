import { useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'

/**
 * Deep link from the search console. A data row opens its section page with
 * `?focus=<id>`, so the page can scroll to the exact record and flash it. The
 * parameter is consumed and removed, so it never reapplies on a later visit.
 */
export function useFocusTarget(): { focusId: string | null; clearFocus: () => void } {
  const [searchParams, setSearchParams] = useSearchParams()
  const focusId = searchParams.get('focus')

  const clearFocus = useMemo(
    () => () => {
      if (focusId === null) return
      const next = new URLSearchParams(searchParams)
      next.delete('focus')
      setSearchParams(next, { replace: true })
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [focusId],
  )

  useEffect(() => {
    if (focusId === null) return
    const tick = window.setTimeout(() => {
      document.querySelector(`[data-focus-id="${focusId}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }, 250)
    return () => window.clearTimeout(tick)
  }, [focusId])

  return { focusId, clearFocus }
}