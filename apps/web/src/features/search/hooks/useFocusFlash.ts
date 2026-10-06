import { useEffect, useState } from 'react'
import { useFocusTarget } from '@/lib/search/focus'
import { cn } from '@/lib/utils'

/**
 * Flashes the row that a search console deep link landed on: user → receives
 * their record long enough to see it, then the focus state releases.
 */
export function useFocusFlash(): { flashId: string | null; flashClass: string | null } {
  const { focusId, clearFocus } = useFocusTarget()
  const [flashId, setFlashId] = useState<string | null>(null)

  useEffect(() => {
    if (focusId === null) return
    const row = document.querySelector(`[data-focus-id="${focusId}"]`)
    if (row) {
      setFlashId(focusId)
      const timer = window.setTimeout(() => {
        setFlashId(null)
        clearFocus()
      }, 2600)
      return () => window.clearTimeout(timer)
    }
    // The record may be on a different page of the list; release so the next
    // navigation is not meta-tagged with a dead target.
    clearFocus()
  }, [focusId, clearFocus])

  return {
    flashId,
    flashClass: cn('ring-2 ring-primary/60 bg-primary/5'),
  }
}