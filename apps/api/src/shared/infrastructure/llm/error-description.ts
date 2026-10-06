/**
 * Renders an error chain for a log line: each frame's name, its error code when
 * it has one (`UND_ERR_CONNECT_TIMEOUT`, `ENOTFOUND`, …), and its message, joined
 * with `→`. `fetch` folds the real fault into `cause`, and network stacks fold
 * it again into an `AggregateError`, so both layers are expanded rather than
 * printing the wrapper alone — that is how an opaque `TypeError: fetch failed`
 * becomes actionable.
 */
export function describeException(cause: unknown): string {
  const seen = new Set<object>()
  const parts: string[] = []

  const visit = (value: unknown): void => {
    if (parts.length >= 8) return
    if (value === undefined || value === null) return
    if (typeof value !== 'object') {
      parts.push(String(value))
      return
    }
    if (seen.has(value)) {
      parts.push('[cycle]')
      return
    }
    seen.add(value)

    const record = value as { name?: unknown; code?: unknown; message?: unknown; cause?: unknown }
    const name = typeof record.name === 'string' && record.name.length > 0 ? record.name : 'Error'
    const message = typeof record.message === 'string' ? record.message : String(value)
    const code = typeof record.code === 'string' ? record.code : undefined
    parts.push(code !== undefined ? `${name} (${code}: ${message})` : `${name}: ${message}`)

    if (Array.isArray((value as { errors?: unknown }).errors)) {
      for (const nested of (value as { errors: readonly unknown[] }).errors) visit(nested)
    } else {
      visit(record.cause)
    }
  }

  visit(cause)
  return parts.join(' → ') || String(cause)
}