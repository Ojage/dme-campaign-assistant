import { Fragment } from 'react'
import { highlightRanges } from '@/features/search/lib/text'

/**
 * Renders `text` with every fuzzy match range emphasised (accent- and
 * case-insensitive). Empties and single words render as plain text with no
 * extra nodes, so this stays cheap in the hot list path.
 */
export function SearchHighlight({ text, query, className }: { text: string; query: string; className?: string }) {
  const ranges = query.trim().length > 0 ? highlightRanges(text, query) : []

  if (ranges.length === 0) return <span className={className}>{text}</span>

  const parts: Array<{ value: string; matched: boolean }> = []
  let cursor = 0
  for (const [start, end] of ranges) {
    if (start > cursor) parts.push({ value: text.slice(cursor, start), matched: false })
    parts.push({ value: text.slice(start, end), matched: true })
    cursor = end
  }
  if (cursor < text.length) parts.push({ value: text.slice(cursor), matched: false })

  return (
    <span className={className}>
      {parts.map((part, index) =>
        part.matched ? (
          <mark
            key={index}
            className="rounded-[3px] bg-primary/20 px-px text-foreground"
          >
            {part.value}
          </mark>
        ) : (
          <Fragment key={index}>{part.value}</Fragment>
        ),
      )}
    </span>
  )
}