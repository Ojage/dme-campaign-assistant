import { useEffect, useState } from 'react'
import { useFocusTarget } from '@/lib/search/focus'
import { cn } from '@/lib/utils'

/**
 * Flashes the row that a search console deep link landed on. When the exact
 * record is not rendered (paged list, "recent" slice), it falls back to
 * flashing the section container given by `fallbackSection` (a
 * `data-focus-section` element) so something always lights up.
 */
export function useFocusFlash(fallbackSection?: string): {
  flashId: string | null
  flashTarget: 'row' | 'section' | null
  flashClass: string | null
} {
  const { focusId, clearFocus } = useFocusTarget()
  const [flashId, setFlashId] = useState<string | null>(null)
  const [flashTarget, setFlashTarget] = useState<'row' | 'section' | null>(null)

  useEffect(() => {
    if (focusId === null) return
    const rowSel = `[data-focus-id="${focusId}"]`
    const sectionSel = fallbackSection ? `[data-focus-section="${fallbackSection}"]` : null
    let flashTimer: number | undefined
    const startFlash = (el: Element) => {
      const target = el.matches(rowSel) ? 'row' : 'section'
      setFlashId(focusId)
      setFlashTarget(target)
      flashTimer = window.setTimeout(() => {
        setFlashId(null)
        setFlashTarget(null)
        clearFocus()
      }, 2600)
    }
    const resolve = () => document.querySelector(rowSel) ?? (sectionSel ? document.querySelector(sectionSel) : null)
    const found = resolve()
    if (found) {
      found.scrollIntoView({ block: 'center', behavior: 'smooth' })
      startFlash(found)
      return () => window.clearTimeout(flashTimer)
    }
    // The record may still be loading (list pages fetch asynchronously), so poll
    // briefly before falling back to (or releasing on) the section.
    let tries = 0
    const poll = window.setInterval(() => {
      tries += 1
      const el = resolve()
      if (el) {
        window.clearInterval(poll)
        el.scrollIntoView({ block: 'center', behavior: 'smooth' })
        startFlash(el)
      } else if (tries >= 12) {
        window.clearInterval(poll)
        clearFocus()
      }
    }, 200)
    return () => {
      window.clearInterval(poll)
      window.clearTimeout(flashTimer)
    }
  }, [focusId, clearFocus, fallbackSection])

  return {
    flashId,
    flashTarget,
    flashClass: cn('ring-2 ring-primary/60 bg-primary/5'),
  }
}