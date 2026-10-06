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
    const findRow = () => document.querySelector(`[data-focus-id="${focusId}"]`)
    let flashTimer: number | undefined
    const startFlash = () => {
      setFlashId(focusId)
      flashTimer = window.setTimeout(() => {
        setFlashId(null)
        clearFocus()
      }, 2600)
    }
    if (findRow()) {
      startFlash()
      return () => window.clearTimeout(flashTimer)
    }
    // The record may still be loading (list pages fetch asynchronously), so
    // poll briefly before releasing the dead target.
    let tries = 0
    const poll = window.setInterval(() => {
      tries += 1
      const row = findRow()
      if (row) {
        window.clearInterval(poll)
        startFlash()
      } else if (tries >= 12) {
        window.clearInterval(poll)
        clearFocus()
      }
    }, 200)
    return () => {
      window.clearInterval(poll)
      window.clearTimeout(flashTimer)
    }
  }, [focusId, clearFocus])

  return {
    flashId,
    flashClass: cn('ring-2 ring-primary/60 bg-primary/5'),
  }
}