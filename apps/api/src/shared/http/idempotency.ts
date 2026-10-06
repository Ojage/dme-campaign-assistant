import { createHash } from 'node:crypto'
import type {
  IdempotencyStore,
  IdempotentResponse,
  JsonValue,
} from '../application/ports/idempotency-store.port'
import { ConflictError, ValidationError } from '../domain/domain.errors'

/**
 * Idempotency policy for operations whose client is allowed to repeat them.
 *
 * A repeated `POST /campaigns/generate` must not create a second campaign: the model
 * call costs money and the record is a real side effect. The client sends an
 * `Idempotency-Key`, and the first response is recorded against it.
 *
 * The rule that makes retries safe is what is *not* recorded: only a success is
 * remembered. Storing a 503 would make the client's retry replay the failure forever
 * and burn the key, turning the mechanism meant to make retries safe into the thing
 * that blocks them.
 *
 * Nothing here imports a framework, so the policy is exercised directly rather than
 * through a container.
 */

export const IDEMPOTENCY_KEY_HEADER = 'idempotency-key'

/** Marks a route whose request may safely be repeated by the client. */
export const IDEMPOTENT_ROUTE = 'idempotent-route'

/** Published so a caller can tell a replay from a fresh result. */
export const IDEMPOTENCY_REPLAYED_HEADER = 'idempotency-replayed'

/** Only a 2xx may be replayed; anything else leaves the key free to retry. */
export function isReplayable(statusCode: number): boolean {
  return statusCode >= 200 && statusCode < 300
}

/**
 * Bounded to what a client can realistically send, and restricted to characters that
 * survive a header round trip. An unbounded key is a cheap way to fill the table with
 * rows nobody can replay.
 */
const KEY_PATTERN = /^[\x21-\x7e]{1,255}$/

/** The key to record against, or `null` when the client did not ask for replay. */
export function parseKey(raw: string | undefined): string | null {
  if (raw === undefined) return null
  const key = raw.trim()
  if (key.length === 0) return null
  if (!KEY_PATTERN.test(key)) {
    throw new ValidationError(
      'The Idempotency-Key header must be 1-255 printable ASCII characters.',
      { [IDEMPOTENCY_KEY_HEADER]: ['Use visible ASCII characters, at most 255 of them.'] },
    )
  }
  return key
}

/**
 * Digest of what the request is asking for.
 *
 * Key order is normalised first: two requests differing only in the order their JSON
 * keys arrived are the same request, so a client retrying through a different
 * serializer is not told it changed its mind.
 */
export function fingerprint(method: string, path: string, body: unknown): string {
  return createHash('sha256')
    .update(`${method} ${path} ${stableStringify(body)}`)
    .digest('hex')
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null'
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .sort(([left], [right]) => (left < right ? -1 : 1))
    .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
  return `{${entries.join(',')}}`
}

/**
 * A recorded response that does not match the request now in hand means the key was
 * reused for a different operation, which is a client bug: answering anyway would
 * return one campaign for a request that asked for another.
 */
export function assertSameRequest(stored: string, current: string): void {
  if (stored === current) return
  throw new ConflictError(
    'This Idempotency-Key was already used for a different request. Use a new key for each distinct request.',
  )
}

/**
 * The already-recorded response to replay, or `null` when this request is the first
 * use of the key and should go through.
 */
export async function findReplay(
  store: IdempotencyStore,
  scope: string,
  key: string,
  digest: string,
): Promise<IdempotentResponse | null> {
  const stored = await store.find(scope, key)
  if (stored === null) return null
  assertSameRequest(stored.fingerprint, digest)
  return stored
}

/**
 * Records a successful response, and reports whether this caller must answer with a
 * different one.
 *
 * `null` means keep the response you already have. A response is returned when the
 * key was already taken, which means a concurrent identical request recorded its
 * answer first: its response is the authoritative one, so this caller is handed it
 * rather than a divergent result of its own.
 */
export async function recordIfSuccessful(
  store: IdempotencyStore,
  scope: string,
  key: string,
  digest: string,
  statusCode: number,
  body: JsonValue,
): Promise<IdempotentResponse | null> {
  // A failure is deliberately not remembered: the key stays reusable so the client
  // can retry the very request that failed.
  if (!isReplayable(statusCode)) return null

  const { response, inserted } = await store.remember(scope, key, {
    fingerprint: digest,
    statusCode,
    body,
  })
  return inserted ? null : response
}