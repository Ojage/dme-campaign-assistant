/**
 * A small, streaming-safe renderer for the Markdown the assistant emits.
 *
 * The agent replies are chat-shaped text: paragraphs, numbered and bullet lists,
 * bold/italic labels, headings and the occasional fence or quote. Rendering that
 * with `whitespace-pre-wrap` (what we did before) shows the literal `**`, `1.` and
 * `#` markers, while pulling in `react-markdown` would reflow every stream delta
 * and flash half-formed syntax at each token.
 *
 * So this module parses a trimmed subset and the React layer only ever formats
 * whole lines: while a reply streams, complete lines render as Markdown and the
 * trailing, partially-typed line stays plain until it finishes. Nothing here emits
 * HTML strings — the view renders text nodes, so model output can never inject
 * markup.
 */

export type InlinePart =
  | { kind: 'text'; value: string }
  | { kind: 'strong'; value: string }
  | { kind: 'em'; value: string }
  | { kind: 'strike'; value: string }
  | { kind: 'code'; value: string }
  | { kind: 'link'; value: string; href: string }

export type MarkdownBlock =
  | { type: 'heading'; level: 1 | 2 | 3; text: string }
  | { type: 'paragraph'; lines: string[] }
  | { type: 'list'; ordered: boolean; items: string[] }
  | { type: 'quote'; lines: string[] }
  | { type: 'code'; lang: string | null; code: string }
  | { type: 'hr' }

const HEADING = /^(#{1,3})\s+(.*)$/
const HR = /^\s*(?:[-*_])\s*(?:[-*_\s]{2,})\s*$/
const QUOTE = /^>\s?(.*)$/
const FENCE_OPEN = /^```([A-Za-z0-9_+-]*)?\s*$/
const FENCE_CLOSE = /^```\s*$/
const BULLET = /^\s*[-*+]\s+(.+)$/
const ORDERED = /^\s*(\d+)[.)]\s+(.+)$/

/**
 * A URL the model printed as text, split out of a plain-text run so it becomes a
 * link. Anything else (email, the `javascript:` prefix) stays literal text.
 */
export const URL_PATTERN = /https?:\/\/(?:[^\s<>"']|$)+/g

/** Only these URI schemes may become an anchor; everything else is rendered as text. */
export function hrefIfSafe(value: string): string | null {
  const candidate = value.trim()
  if (/^(https?:|mailto:)/i.test(candidate)) return candidate
  return null
}

/**
 * Splits a raw message into whole lines for Markdown and the trailing partial line,
 * which must stay plain while it is still arriving.
 */
export function splitStreamingLines(text: string, streaming: boolean): {
  complete: string[]
  pending: string | null
} {
  const lines = text.split('\n')
  if (!streaming || text === '') return { complete: lines, pending: null }
  const terminated = text.endsWith('\n')
  return {
    complete: terminated ? lines : lines.slice(0, -1),
    pending: terminated ? null : (lines.at(-1) ?? null),
  }
}

/** Pulls the matched delimiter content out of a fully-wrapped inline part. */
function unwrap(part: string, open: string, close: string): string {
  return part.slice(open.length, part.length - close.length)
}

const INLINE_SPLIT = /(\*\*[^*]+\*\*|__[^_]+__|~~[^~]+~~|`[^`]+`|\[[^\]\n]+\]\([^)\n]+\)|\*[^*]+\*|_[^_]+_)/g

/** Breaks inline text into styled runs; bare text stays intact for URL splitting. */
export function parseInline(text: string): InlinePart[] {
  const parts = text.split(INLINE_SPLIT)
  const out: InlinePart[] = []

  for (const part of parts) {
    if (part === '') continue

    if (/^\*\*[^*]+\*\*$/.test(part) || /^__[^_]+__$/.test(part)) {
      out.push({ kind: 'strong', value: unwrap(part, part.startsWith('**') ? '**' : '__', part.startsWith('**') ? '**' : '__') })
    } else if (/^~~[^~]+~~$/.test(part)) {
      out.push({ kind: 'strike', value: unwrap(part, '~~', '~~') })
    } else if (/^`[^`]+`$/.test(part)) {
      out.push({ kind: 'code', value: unwrap(part, '`', '`') })
    } else if (/^\*[^*]+\*$/.test(part)) {
      out.push({ kind: 'em', value: unwrap(part, '*', '*') })
    } else if (/^_[^_]+_$/.test(part)) {
      out.push({ kind: 'em', value: unwrap(part, '_', '_') })
    } else {
      const link = /^\[([^\]\n]+)\]\(([^)\n]+)\)$/.exec(part)
      if (link) {
        out.push({ kind: 'link', value: link[1], href: link[2] })
      } else {
        out.push({ kind: 'text', value: part })
      }
    }
  }

  return out
}

interface ListMatch {
  ordered: boolean
  content: string
}

function matchList(line: string): ListMatch | null {
  const ordered = ORDERED.exec(line)
  if (ordered) return { ordered: true, content: ordered[2] }
  const bullet = BULLET.exec(line)
  if (bullet) return { ordered: false, content: bullet[1] }
  return null
}

/** Parses whole lines into Markdown blocks. The pending partial line is not passed in. */
export function parseBlocks(lines: readonly string[]): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = []

  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()
    if (trimmed === '') {
      i += 1
      continue
    }

    const fence = FENCE_OPEN.exec(line)
    if (fence) {
      const lang = fence[1] === '' ? null : fence[1]
      const code: string[] = []
      i += 1
      while (i < lines.length && !FENCE_CLOSE.test(lines[i])) {
        code.push(lines[i])
        i += 1
      }
      if (i < lines.length) i += 1 // swallow the closing fence
      blocks.push({ type: 'code', lang, code: code.join('\n') })
      continue
    }

    const heading = HEADING.exec(line)
    if (heading) {
      blocks.push({ type: 'heading', level: heading[1].length as 1 | 2 | 3, text: heading[2] })
      i += 1
      continue
    }

    if (HR.test(line)) {
      blocks.push({ type: 'hr' })
      i += 1
      continue
    }

    const quoted = QUOTE.exec(line)
    if (quoted) {
      const quote: string[] = [quoted[1]]
      i += 1
      while (i < lines.length) {
        const q = QUOTE.exec(lines[i])
        if (!q) break
        quote.push(q[1])
        i += 1
      }
      blocks.push({ type: 'quote', lines: quote })
      continue
    }

    const first = matchList(line)
    if (first) {
      const items: string[] = [first.content]
      const ordered = first.ordered
      i += 1
      while (i < lines.length) {
        const next = matchList(lines[i])
        if (!next || next.ordered !== ordered) break
        items.push(next.content)
        i += 1
      }
      // A list interrupted only by blank lines restarts into a new block; stitch it
      // back into the previous one so "1. a\u2026\n\n1. b\u2026" renders as 1., 2., not 1., 1.
      const previous = blocks.at(-1)
      if (previous && previous.type === 'list' && previous.ordered === ordered && blocks.length >= 1) {
        previous.items.push(...items)
      } else {
        blocks.push({ type: 'list', ordered, items })
      }
      continue
    }

    const paragraph: string[] = [line]
    i += 1
    while (i < lines.length) {
      const next = lines[i]
      const breaksBlock =
        next.trim() === '' ||
        FENCE_OPEN.test(next) ||
        HEADING.test(next) ||
        HR.test(next) ||
        QUOTE.test(next) ||
        matchList(next) !== null
      if (breaksBlock) break
      paragraph.push(next)
      i += 1
    }
    blocks.push({ type: 'paragraph', lines: paragraph })
  }

  return blocks
}