import { deprecationHeaders, findOperation, operations, streamingOperations } from '@dme/contracts'
import type { OperationLike } from '@dme/contracts'

/**
 * Deprecation signalling, free of any framework so it can be reasoned about and
 * tested on its own.
 *
 * The registry is the only place an operation is marked deprecated, so the header
 * cannot drift from the generated specification: if the specification says an
 * operation is deprecated, the response says so too.
 */

/** Every operation the API serves, streaming endpoints included. */
export const apiRegistry: Readonly<Record<string, OperationLike>> = { ...operations, ...streamingOperations }

/** The route a request was matched to, in the same shape the registry uses. */
export interface RouteDescriptor {
  readonly method: string
  /** Express route pattern such as `/segments/:id`, or undefined before routing. */
  readonly routePath?: string | undefined
  /** Request path, used only when no route pattern is available. */
  readonly path?: string | undefined
}

/**
 * Headers to add to a response for the operation serving a route.
 *
 * An undocumented route gets nothing, which keeps internal endpoints silent
 * instead of advertising them as part of the public API.
 */
export function responseHeadersFor(
  route: RouteDescriptor,
  registry: Readonly<Record<string, OperationLike>> = apiRegistry,
): Readonly<Record<string, string>> {
  const path = route.routePath ?? route.path
  if (path === undefined) return {}
  return deprecationHeaders(findOperation(registry, route.method, path))
}