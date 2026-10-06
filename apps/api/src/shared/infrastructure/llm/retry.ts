import { ModelProviderError } from '../../domain/domain.errors'

/**
 * Truncated exponential backoff with jitter, for transient provider faults.
 *
 * Two decisions are baked in, and both matter:
 *
 * - **Only `llm_unavailable` is retried.** `llm_error` means the provider read the
 *   request and refused it — a rejected key, a malformed schema, a cancelled call.
 *   Repeating any of those is pure latency.
 * - **The same provider is retried, never another.** Selection is config-time; a
 *   provider that stays down surfaces as a 503 rather than being quietly swapped.
 */

/** How many times a call may be attempted, and how long to wait between tries. */
export interface RetryPolicy {
  /** Including the first attempt, so `3` is one call plus two retries. */
  readonly maxAttempts: number
  readonly baseDelayMs: number
  /** Ceiling on a single wait, so the backoff stays truncated. */
  readonly maxDelayMs: number
  /** Returns a value in `[0, 1)`, scaled onto the computed delay. Injected for tests. */
  readonly jitter: () => number
  /** Injected so tests do not actually wait. */
  readonly sleep: (ms: number, signal: AbortSignal | undefined) => Promise<void>
}

export const DEFAULT_RETRY_POLICY: Omit<RetryPolicy, 'jitter' | 'sleep'> = {
  maxAttempts: 3,
  baseDelayMs: 250,
  maxDelayMs: 4_000,
}

/** A default policy with real jitter and a real timer. */
export function defaultRetryPolicy(overrides: Partial<Omit<RetryPolicy, 'jitter' | 'sleep'>> = {}): RetryPolicy {
  return {
    ...DEFAULT_RETRY_POLICY,
    ...overrides,
    jitter: Math.random,
    sleep: sleepUnlessAborted,
  }
}

/**
 * A fault worth repeating. `llm_unavailable` is the taxonomy's way of saying the
 * provider never really answered, which is exactly the definition of transient.
 */
export function isRetryable(error: unknown): boolean {
  return error instanceof ModelProviderError && error.code === 'llm_unavailable'
}

/**
 * Truncated exponential backoff, with the delay drawn uniformly from
 * `[0, cap)`.
 *
 * Sampling the *whole* interval rather than adding a fixed offset is what breaks
 * up a synchronised retry storm: if a gateway returns at once for a hundred
 * clients, a fixed jitter still lets them converge on the same instants, while a
 * uniform draw spreads them across the window.
 */
export function backoffDelayMs(policy: RetryPolicy, attemptIndex: number): number {
  const ceiling = Math.min(policy.maxDelayMs, policy.baseDelayMs * 2 ** attemptIndex)
  return Math.round(policy.jitter() * ceiling)
}

/** Whether another attempt is permitted, given the budget and the failure. */
export function canRetry(
  policy: RetryPolicy,
  attemptsMade: number,
  error: unknown,
  signal: AbortSignal | undefined,
): boolean {
  if (signal?.aborted === true) return false
  return attemptsMade < policy.maxAttempts && isRetryable(error)
}

/** Runs `operation`, repeating it while the fault is transient and the budget allows. */
export async function withRetry<T>(
  policy: RetryPolicy,
  signal: AbortSignal | undefined,
  operation: () => Promise<T>,
): Promise<T> {
  for (let attemptsMade = 1; ; attemptsMade += 1) {
    try {
      return await operation()
    } catch (error) {
      if (!canRetry(policy, attemptsMade, error, signal)) throw error
      await policy.sleep(backoffDelayMs(policy, attemptsMade - 1), signal)
    }
  }
}

/**
 * Sleeps, but gives up as soon as the caller cancels.
 *
 * Without this the backoff would be paid in full after a browser has navigated
 * away, holding the request open for the delay it was going to abandon anyway.
 */
export function sleepUnlessAborted(ms: number, signal: AbortSignal | undefined): Promise<void> {
  if (signal?.aborted === true) return Promise.resolve()
  return new Promise((resolve) => {
    const done = (): void => {
      signal?.removeEventListener('abort', done)
      resolve()
    }
    const timer = setTimeout(done, ms)
    signal?.addEventListener('abort', done, { once: true })
    // Keeps the process alive only for the delay, never longer.
    if (typeof timer.unref === 'function') timer.unref()
  })
}