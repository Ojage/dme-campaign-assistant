/**
 * Recognising cancellation across a realm boundary.
 *
 * These errors are `DOMException`s produced by Node internals, not by this
 * codebase. `instanceof Error` is therefore not a safe test: an error that crossed
 * a `vm` context, worker or Jest's sandbox realm fails the check even though it is
 * plainly an `AbortError`. The `name` is set by the platform and does cross realms,
 * so that is what is matched.
 */
export function errorName(cause: unknown): string | undefined {
  if (typeof cause !== 'object' || cause === null || !('name' in cause)) return undefined
  return String((cause as { name: unknown }).name)
}

/**
 * True when the caller's signal fired.
 *
 * `APIUserAbortError` is the Anthropic SDK's name for the same thing, which is why
 * a plain `AbortError` check is not enough to cover both adapters.
 */
export function isAbortError(cause: unknown): boolean {
  const name = errorName(cause)
  return name === 'AbortError' || name === 'APIUserAbortError'
}