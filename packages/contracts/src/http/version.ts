/**
 * API versioning policy, expressed once so the client, the server and the
 * generated specification cannot disagree about it.
 *
 * The version lives in the URL path (`/api/v1/...`) rather than in a header or a
 * media type: a versioned URL is visible in logs, caches, browser history and
 * `curl`, and a caller who bookmarks a request cannot silently end up on a
 * different version of it.
 *
 * Within `v1` only additive changes are allowed — new optional request fields,
 * new response fields, new endpoints. Anything that removes a field, narrows a
 * type, changes a status code or alters a default is breaking and ships as
 * `v2`, with the old version kept alive until a `Sunset` header is published
 * with it. See `docs/api-versioning.md`.
 */

/** The version this package speaks. Bumping it here versions the whole API. */
export const API_VERSION = 'v1'

/** Prefix applied to every operation path declared in the registry. */
export const API_VERSION_PREFIX = `/${API_VERSION}`

/** Response header every API response carries, so a client can assert its version. */
export const API_VERSION_HEADER = 'x-api-version'

/** RFC 8594 style deprecation signalling, used when an operation is superseded. */
export const DEPRECATION_HEADER = 'deprecation'

/** RFC 8594 sunset date, published once a deprecated version has a removal date. */
export const SUNSET_HEADER = 'sunset'

/**
 * The slice of the operation registry this module needs. Declared structurally so
 * the helpers can be exercised with a synthetic registry in tests.
 */
export interface OperationLike {
  readonly method: string
  readonly path: string
  readonly deprecated?: boolean
  readonly sunset?: string
}

/** Prefixes an operation path with the current version segment. */
export function versionedPath(path: string): string {
  return `${API_VERSION_PREFIX}${path.startsWith('/') ? path : `/${path}`}`
}
/**
 * Finds the operation that serves a method/path pair, or undefined when the
 * route is not part of the documented API.
 *
 * Paths use the same `:param` shape as Express (`/segments/:id`), so a route can
 * be matched against the registry without normalising either side.
 */
export function findOperation(
  registry: Readonly<Record<string, OperationLike>>,
  method: string,
  path: string,
): OperationLike | undefined {
  const wanted = method.toUpperCase()
  const match = Object.values(registry).find(
    (operation) => operation.method === wanted && operation.path === path,
  )
  return match
}

/**
 * The deprecation headers an operation's response must carry, per RFC 8594.
 *
 * Returns nothing for a live operation, so callers can spread the result
 * unconditionally without emitting empty headers.
 */
export function deprecationHeaders(operation: OperationLike | undefined): Readonly<Record<string, string>> {
  if (operation === undefined || operation.deprecated !== true) return {}
  const headers: Record<string, string> = { [DEPRECATION_HEADER]: 'true' }
  if (operation.sunset !== undefined) headers[SUNSET_HEADER] = operation.sunset
  return headers
}
