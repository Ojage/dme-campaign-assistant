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
 * Durable idempotency records.
 *
 * The store, not the caller, decides which record wins when two identical requests
 * race, so that both callers are given the same answer.
 */
export interface RememberedResponse {
  readonly response: IdempotentResponse
  /** `false` when the key was already taken, so the caller must adopt this response. */
  readonly inserted: boolean
}

export interface IdempotencyStore {
  find(scope: string, key: string): Promise<IdempotentResponse | null>
  /**
   * Records the response, or reports the record already stored under the key when
   * another request got there first. Never throws on a duplicate: a key that is
   * already taken is a normal outcome, not an error.
   */
  remember(scope: string, key: string, response: IdempotentResponse): Promise<RememberedResponse>
}

/** Only successful responses are recorded; a failure must stay retryable. */
export function isReplayable(statusCode: number): boolean {
  return statusCode >= 200 && statusCode < 300
}

export const IDEMPOTENCY_STORE = Symbol('IDEMPOTENCY_STORE')