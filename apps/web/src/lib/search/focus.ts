import { useCallback, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'

/**
 * Deep link from the search console. A data row opens its section page with
 * `?focus=<id>`, so the page can scroll to the exact record and flash it. The
 * parameter is consumed and removed, so it never reapplies on a later visit.
 *
 * The id is escaped before it is interpolated into the selector, so ids that
 * contain characters with special meaning in a CSS attribute selector (quotes,
 * backslashes, whitespace) still match their own row.
 */
export function useFocusTarget(): { focusId: string | null; clearFocus: () => void } {
  const [searchParams, setSearchParams] = useSearchParams()
  const focusId = searchParams.get('focus')

  const clearFocus = useCallback(() => {
    if (focusId === null) return
    setSearchParams(
      (next) => {
        next.delete('focus')
        return next
      },
      { replace: true },
    )
  }, [focusId, setSearchParams])

  useEffect(() => {
    if (focusId === null) return
    const tick = window.setTimeout(() => {
      document.querySelector(`[data-focus-id="${CSS.escape(focusId)}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }, 250)
    return () => window.clearTimeout(tick)
  }, [focusId])

  return { focusId, clearFocus }
}