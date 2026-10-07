/**
 * Anything that survives a JSON round trip. A recorded response is the body the API
 * already serialised, so there is nothing more exotic to store.
 */
export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }

/**
 * A response recorded against an idempotency key, so a repeated request can be
 * answered with the original outcome instead of doing the work again.
 */
export interface IdempotentResponse {
  /** Digest of the request this key was first used with. */
  readonly fingerprint: string
  readonly statusCode: number
  readonly body: JsonValue
}

/**
 * The outcome of attempting to claim an idempotency key.
 *
 * `owner` is true exactly when this caller inserted the processing row and is the
 * one entitled to run the handler and record the result. `completed` is non-null
 * when the key already holds a finished response to replay, and `processingSince`
 * tells a non-owner how long the winning request has been running — which is how
 * an abandoned claim (a crashed owner) can be detected and taken over.
 */
export interface IdempotencyClaim {
  readonly owner: boolean
  /** Present when the key already holds a completed response. */
  readonly completed: IdempotentResponse | null
  /** When the winning request claimed the key; null when this caller owns it. */
  readonly processingSince: Date | null
  /** The claimed row's id, used by the owner to complete or release it. */
  readonly id: string | null
}

/** What sits behind an idempotency key right now. */
export type IdempotencyStatus =
  | { readonly state: 'completed'; readonly response: IdempotentResponse }
  | { readonly state: 'processing'; readonly fingerprint: string; readonly processingSince: Date }
  | { readonly state: 'absent' }

/**
 * Durable idempotency records.
 *
 * The store, not the caller, decides which of two racing identical requests owns
 * the record, so both callers converge on one answer and only one runs the side
 * effect.
 */
export interface IdempotencyStore {
  find(scope: string, key: string): Promise<IdempotentResponse | null>
  /**
   * Attempts to take the key for this request. A key that is already claimed is a
   * normal outcome, not an error: the unique index on `(scope, key)` decides the
   * owner, and the claimant is handed the state it needs to wait or take over.
   */
  claim(scope: string, key: string, fingerprint: string): Promise<IdempotencyClaim>
  /** The current state behind a key, so a waiting caller can poll it. */
  statusOf(scope: string, key: string): Promise<IdempotencyStatus>
  /**
   * Publishes the owner's finished response. A no-op when the row is gone or was
   * taken over, so a dead request cannot overwrite a result that replaced it.
   */
  complete(scope: string, key: string, id: string, response: IdempotentResponse): Promise<void>
  /**
   * Frees a processing key without recording a response — for a failed handler (so
   * the key stays retryable) or an abandoned claim (so a waiting caller can take
   * over). Never throws and never touches a completed row.
   */
  release(scope: string, key: string, id?: string): Promise<void>
  /**
   * Deletes completed rows older than `retentionMs`, so the table cannot grow
   * without bound. Returns how many were removed.
   */
  prune(now: Date, retentionMs: number): Promise<number>
}

/** Only successful responses are recorded; a failure must stay retryable. */
export function isReplayable(statusCode: number): boolean {
  return statusCode >= 200 && statusCode < 300
}

export const IDEMPOTENCY_STORE = Symbol('IDEMPOTENCY_STORE')