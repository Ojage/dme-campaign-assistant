import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

interface AssistantActivityValue {
  /** Names of the surfaces that currently have work in flight. */
  active: ReadonlySet<string>
  begin: (source: string) => void
  end: (source: string) => void
}

const AssistantActivityContext = createContext<AssistantActivityValue | null>(null)

/**
 * Tracks which surfaces have work in flight, so one indicator can be shown
 * wherever the assistant is busy.
 *
 * Work is registered under a caller-chosen name rather than as a count. Two
 * surfaces can be busy at once — a chat reply and a campaign generation — and a
 * bare boolean would let whichever finished first switch the indicator off while
 * the other was still running. Names also make the effect cleanup in
 * `useAssistantActivity` idempotent under StrictMode's double invocation.
 */
export function AssistantActivityProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<ReadonlySet<string>>(() => new Set())

  const begin = useCallback((source: string) => {
    setActive((previous) => {
      if (previous.has(source)) return previous
      const next = new Set(previous)
      next.add(source)
      return next
    })
  }, [])

  const end = useCallback((source: string) => {
    setActive((previous) => {
      if (!previous.has(source)) return previous
      const next = new Set(previous)
      next.delete(source)
      return next
    })
  }, [])

  const value = useMemo(() => ({ active, begin, end }), [active, begin, end])

  return <AssistantActivityContext.Provider value={value}>{children}</AssistantActivityContext.Provider>
}

function useAssistantActivityContext(source: string): AssistantActivityValue {
  const context = useContext(AssistantActivityContext)
  if (context === null) {
    throw new Error(`useAssistantActivity("${source}") needs an AssistantActivityProvider above it`)
  }
  return context
}

/**
 * Hold the activity indicator up for as long as `busy` is true.
 *
 * The release lives in the effect cleanup so a surface unmounting mid-request —
 * navigating away while a campaign generates, closing the drawer — cannot strand
 * the indicator in the on state.
 */
export function useAssistantActivity(source: string, busy: boolean): void {
  const { begin, end } = useAssistantActivityContext(source)

  useEffect(() => {
    if (!busy) return
    begin(source)
    return () => end(source)
  }, [busy, source, begin, end])
}

/** True while any surface has work in flight. */
export function useAssistantIsWorking(): boolean {
  const context = useContext(AssistantActivityContext)
  return context !== null && context.active.size > 0
}