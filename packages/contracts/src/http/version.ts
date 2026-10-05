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

/** Prefixes an operation path with the current version segment. */
export function versionedPath(path: string): string {
  return `${API_VERSION_PREFIX}${path.startsWith('/') ? path : `/${path}`}`
}