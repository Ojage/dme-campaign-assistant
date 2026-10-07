/**
 * A small fixed-window in-memory rate limiter.
 *
 * In-memory by design: a single API process with no external store, which keeps the
 * guard installable anywhere without standing up Redis. The window slides by
 * comparison with the bucket's reset time rather than by ticking, so no timer has to
 * run at all.
 *
 * Buckets are cleaned opportunistically: once the map grows past a cap, expired
 * entries are dropped before the oldest remaining one is evicted, so a burst of
 * unique spoofable keys cannot grow memory without bound.
 */

export interface RateLimitRule {
  /** Window length in milliseconds. */
  readonly windowMs: number
  /** Calls a single key may make within the window. */
  readonly max: number
}

const MAX_BUCKETS = 10_000

interface Bucket {
  count: number
  resetAt: number
}

export interface RateVerdict {
  readonly allowed: boolean
  /** Whole seconds until the window resets, for the Retry-After header. */
  readonly retryAfterSeconds: number
}

export class FixedWindowRateLimiter {
  private readonly buckets = new Map<string, Bucket>()

  public constructor(private readonly rule: RateLimitRule) {}

  public hit(key: string, now: number = Date.now()): RateVerdict {
    const bucket = this.buckets.get(key)
    if (bucket === undefined || now >= bucket.resetAt) {
      if (this.buckets.size >= MAX_BUCKETS) this.sweep(now)
      this.buckets.set(key, { count: 1, resetAt: now + this.rule.windowMs })
      return { allowed: true, retryAfterSeconds: 0 }
    }
    if (bucket.count < this.rule.max) {
      bucket.count += 1
      return { allowed: true, retryAfterSeconds: 0 }
    }
    const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1_000))
    return { allowed: false, retryAfterSeconds }
  }

  private sweep(now: number): void {
    for (const [key, bucket] of this.buckets) {
      if (now >= bucket.resetAt) this.buckets.delete(key)
      if (this.buckets.size < MAX_BUCKETS) return
    }
    // Everything still present is hot; evict the oldest-inserted one.
    const oldest = this.buckets.keys().next()
    if (!oldest.done) this.buckets.delete(oldest.value)
  }
}

/** Sign-in window: enough room for a human, tight enough to slow credential guessing. */
const SIGN_IN_RULE: RateLimitRule = { windowMs: 15 * 60 * 1_000, max: 8 }

/** Route scopes the guard understands, each carrying its own rule. */
export const RATE_LIMIT_RULES: Readonly<Record<RateLimitScope, RateLimitRule>> = {
  'sign-in': SIGN_IN_RULE,
}

export type RateLimitScope = 'sign-in'