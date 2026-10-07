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
 * use of the key and should go through. Only completed rows are considered.
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

/** How a waiting duplicate polls the winner's claim for a resolution. */
export const IDEMPOTENCY_POLL_INTERVAL_MS = 250

/** How long a duplicate waits for the winner before answering "already in progress". */
export const IDEMPOTENCY_WAIT_TIMEOUT_MS = 30_000

/**
 * A processing claim older than this is presumed abandoned — the owner's process
 * died before recording — and may be taken over by the next request for the key.
 * Generous because a generation can legitimately be slow.
 */
export const IDEMPOTENCY_STALE_AFTER_MS = 120_000

/** How many claim/wait rounds before declaring the key permanently contended. */
const MAX_CLAIM_ATTEMPTS = 3

/** Completed records older than this are pruned; a replayable key has a shelf life. */
export const IDEMPOTENCY_RETENTION_MS = 7 * 24 * 60 * 60 * 1000

const IN_PROGRESS_MESSAGE =
  'This request is already being processed. Retry with the same idempotency key once it has completed.'

/** Timing controls, so tests can exercise the wait and takeover paths with short values. */
export interface IdempotencyTiming {
  readonly pollIntervalMs?: number
  readonly waitTimeoutMs?: number
  readonly staleAfterMs?: number
  readonly retentionMs?: number
}

export interface CoordinateResult<B extends JsonValue> {
  /** True when this answer is a recorded replay rather than a fresh execution. */
  readonly replay: boolean
  readonly statusCode: number
  readonly body: B
}

/**
 * Runs one idempotent request.
 *
 * A fresh key is claimed first: the claim row is what tells a concurrent duplicate
 * to wait, so two identical requests converge on a single execution of `execute`
 * and a single recorded answer. The winner records its successful response; a
 * failure releases the claim, so the key stays retryable. A duplicate waits for the
 * winner's answer and replays it, and takes over a claim whose owner clearly died.
 *
 * This is the only place that talks to the store, and it never touches a framework.
 */
export async function coordinate<B extends JsonValue>(
  store: IdempotencyStore,
  input: {
    readonly scope: string
    readonly key: string
    readonly digest: string
    readonly execute: () => Promise<{ readonly statusCode: number; readonly body: B }>
  },
  timing: IdempotencyTiming = {},
): Promise<CoordinateResult<B>> {
  const pollIntervalMs = timing.pollIntervalMs ?? IDEMPOTENCY_POLL_INTERVAL_MS
  const waitTimeoutMs = timing.waitTimeoutMs ?? IDEMPOTENCY_WAIT_TIMEOUT_MS
  const staleAfterMs = timing.staleAfterMs ?? IDEMPOTENCY_STALE_AFTER_MS
  const retentionMs = timing.retentionMs ?? IDEMPOTENCY_RETENTION_MS

  const replayed = await findReplay(store, input.scope, input.key, input.digest)
  if (replayed !== null) return { replay: true, statusCode: replayed.statusCode, body: replayed.body as B }

  // Keep the table bounded: completed rows older than the retention window are
  // dropped alongside this traffic.
  await store.prune(new Date(), retentionMs)

  let attempts = 0
  while (attempts++ < MAX_CLAIM_ATTEMPTS) {
    const claim = await store.claim(input.scope, input.key, input.digest)
    if (claim.completed !== null) {
      assertSameRequest(claim.completed.fingerprint, input.digest)
      return { replay: true, statusCode: claim.completed.statusCode, body: claim.completed.body as B }
    }

    if (claim.owner) {
      let statusCode: number
      let body: B
      try {
        ({ statusCode, body } = await input.execute())
      } catch (error) {
        // A failure must not claim the key: free it so the client's retry runs again.
        await store.release(input.scope, input.key, claim.id ?? undefined)
        throw error
      }
      if (isReplayable(statusCode)) {
        await store.complete(input.scope, input.key, claim.id as string, {
          fingerprint: input.digest,
          statusCode,
          body,
        })
      } else {
        await store.release(input.scope, input.key, claim.id ?? undefined)
      }
      return { replay: false, statusCode, body }
    }

    const resolution = await waitForResolution(store, input.scope, input.key, input.digest, {
      pollIntervalMs,
      waitTimeoutMs,
      staleAfterMs,
    })

    if (resolution !== 'retry') {
      return { replay: true, statusCode: resolution.statusCode, body: resolution.body as B }
    }
    // The claim disappeared (released or taken over): loop and claim it ourselves.
  }

  throw new ConflictError(IN_PROGRESS_MESSAGE)
}

/**
 * Waits for the winner of a contested key to record its answer.
 *
 * `'retry'` means the key is no longer claimed at all and the caller should claim
 * it itself. A processing claim whose owner has clearly died (older than the stale
 * threshold) is released so the next loop can take it over; a mismatch between the
 * claimed request and ours is a key-reuse bug and is rejected outright.
 */
async function waitForResolution(
  store: IdempotencyStore,
  scope: string,
  key: string,
  digest: string,
  timing: { readonly pollIntervalMs: number; readonly waitTimeoutMs: number; readonly staleAfterMs: number },
): Promise<IdempotentResponse | 'retry'> {
  const deadline = Date.now() + timing.waitTimeoutMs
  while (Date.now() < deadline) {
    await sleep(timing.pollIntervalMs)
    const status = await store.statusOf(scope, key)

    if (status.state === 'completed') {
      assertSameRequest(status.response.fingerprint, digest)
      return status.response
    }
    if (status.state === 'absent') return 'retry'

    // The winning request is still running. A claim for a different request is a
    // key-reuse bug regardless of timing, so it fails rather than being waited on.
    assertSameRequest(status.fingerprint, digest)
    if (Date.now() - status.processingSince.getTime() > timing.staleAfterMs) {
      await store.release(scope, key)
      return 'retry'
    }
  }
  throw new ConflictError(IN_PROGRESS_MESSAGE)
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}