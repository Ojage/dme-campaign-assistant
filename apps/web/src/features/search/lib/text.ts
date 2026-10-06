/**
 * Accent- and case-insensitive text helpers for search.
 *
 * Matching never mutates the original text, so indexes produced here stay valid
 * for highlighting. `foldAccents` on a single code point maps a decomposed
 * letter (É → e) without shortening the string, which is what keeps the original
 * indexes usable.
 */

export function foldAccents(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

/** Folded text plus, for every folded character, its index in the original. */
export function foldWithIndexes(value: string): { folded: string; map: number[] } {
  const foldedChars: string[] = []
  const map: number[] = []
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index]
    const folded = foldAccents(char)
    if (folded.length > 0) {
      foldedChars.push(folded.toLowerCase())
      map.push(index)
    }
  }
  return { folded: foldedChars.join(''), map }
}

export interface FuzzyResult {
  score: number
  /** Indexes (in the original text) of the characters consumed by the match. */
  indices: number[]
}

/**
 * Subsequence fuzzy match: every query character must appear in order, with a
 * small penalty for gaps and a bonus for a prefix match. Returns null when the
 * text cannot contain the query. Used for navigating so a page like "Customers"
 * is reachable from "cust", "clients" from "cli" and so on.
 */
export function fuzzyMatch(rawQuery: string, rawText: string): FuzzyResult | null {
  const query = foldAccents(rawQuery.trim().toLowerCase())
  const { folded } = foldWithIndexes(rawText)
  if (query.length === 0) return { score: 0, indices: [] }

  let queryIndex = 0
  let score = 0
  const foldedIndices: number[] = []
  for (let textIndex = 0; textIndex < folded.length && queryIndex < query.length; textIndex += 1) {
    if (folded[textIndex] === query[queryIndex]) {
      // A consecutive run is worth more than a scattered one — that is how a
      // contiguous abbreviation beats three lucky characters.
      const continuation = foldedIndices[foldedIndices.length - 1] === textIndex - 1
      score += continuation ? 3 : 2
      foldedIndices.push(textIndex)
      queryIndex += 1
    } else {
      score -= 0.4
    }
  }
  if (queryIndex < query.length) return null

  if (folded.startsWith(query)) score += 8
  if (foldedIndices[0] === 0) score += 3

  const { map } = foldWithIndexes(rawText)
  return { score, indices: foldedIndices.map((index) => map[index]) }
}

export type HighlightRange = [start: number, end: number]

/**
 * Substrings of `text` that contain any word of `query`, merged into contiguous
 * ranges and mapped back onto original (unfolded) indexes. `query` is split on
 * whitespace, so a phrase highlights each word independently.
 */
export function highlightRanges(text: string, query: string): HighlightRange[] {
  const tokens = query
    .trim()
    .split(/\s+/)
    .map((token) => foldAccents(token.toLowerCase()))
    .filter((token) => token.length > 0)
    .sort((a, b) => b.length - a.length)
  if (tokens.length === 0) return []

  const { folded, map } = foldWithIndexes(text)
  const raw: number[][] = []
  for (const token of tokens) {
    let start = 0
    while (true) {
      const at = folded.indexOf(token, start)
      if (at === -1) break
      raw.push([at, at + token.length])
      start = at + token.length
    }
  }
  if (raw.length === 0) return []

  raw.sort((a, b) => a[0] - b[0])
  const merged: HighlightRange[] = []
  for (const [start, end] of raw) {
    const last = merged[merged.length - 1]
    if (last && start <= last[1]) {
      last[1] = Math.max(last[1], end)
    } else {
      merged.push([start, end])
    }
  }
  return merged.map(([start, end]) => [map[start], map[end - 1] + 1])
}

/** True when every word of `query` appears in `text`, in any order. */
export function coversWords(rawQuery: string, text: string): boolean {
  const { folded } = foldWithIndexes(text)
  const tokens = rawQuery
    .trim()
    .split(/\s+/)
    .map((token) => foldAccents(token.toLowerCase()))
    .filter((token) => token.length > 0)
  return tokens.length > 0 && tokens.every((token) => folded.includes(token))
}