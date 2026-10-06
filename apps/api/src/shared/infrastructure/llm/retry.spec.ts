import { ModelProviderError, ValidationError } from '../../domain/domain.errors'
import { backoffDelayMs, canRetry, defaultRetryPolicy, isRetryable, withRetry } from './retry'
import type { RetryPolicy } from './retry'

/**
 * The retry policy decides whether a failure is repeated, and the backoff decides
 * how long the caller waits first. Both are easy to get subtly wrong in ways tests
 * would not otherwise catch — an off-by-one in the attempt budget, or jitter that
 * narrows instead of spreads — so the arithmetic is pinned here directly.
 */

/** Records the waits instead of performing them, so nothing sleeps. */
function recordingPolicy(overrides: Partial<RetryPolicy> = {}): { policy: RetryPolicy; waits: number[] } {
  const waits: number[] = []
  const policy: RetryPolicy = {
    maxAttempts: 3,
    baseDelayMs: 100,
    maxDelayMs: 400,
    jitter: () => 1,
    sleep: async (ms) => {
      waits.push(ms)
    },
    ...overrides,
  }
  return { policy, waits }
}

const unavailable = (): ModelProviderError => new ModelProviderError(undefined, 'llm_unavailable')
const rejected = (): ModelProviderError => new ModelProviderError(undefined, 'llm_error')

describe('isRetryable', () => {
  it('retries an unavailable provider, which never really answered', () => {
    expect(isRetryable(unavailable())).toBe(true)
  })

  it('does not retry a request the provider read and refused', () => {
    expect(isRetryable(rejected())).toBe(false)
  })

  it('does not retry a failure that is not a provider fault at all', () => {
    expect(isRetryable(new ValidationError())).toBe(false)
    expect(isRetryable(new Error('boom'))).toBe(false)
    expect(isRetryable(undefined)).toBe(false)
  })
})

describe('backoffDelayMs', () => {
  it('grows exponentially while the jitter lands on the ceiling', () => {
    const { policy } = recordingPolicy({ jitter: () => 1 })
    expect(backoffDelayMs(policy, 0)).toBe(100)
    expect(backoffDelayMs(policy, 1)).toBe(200)
    expect(backoffDelayMs(policy, 2)).toBe(400)
  })

  it('is truncated, so the wait never exceeds the configured ceiling', () => {
    const { policy } = recordingPolicy({ jitter: () => 1 })
    expect(backoffDelayMs(policy, 10)).toBe(400)
  })

  it('draws uniformly from the whole interval, never from a fixed slice', () => {
    // Full jitter is what actually breaks up a synchronised retry storm: a gateway
    // recovering from one outage releases every client at the same moment, so the
    // delay must be spread across the window rather than merely offset inside it.
    const { policy } = recordingPolicy({ jitter: () => 0 })
    expect(backoffDelayMs(policy, 3)).toBe(0)
    // attempt 3: base 100 doubled three times is 800, truncated to the 400 ceiling.
    const { policy: half } = recordingPolicy({ jitter: () => 0.5 })
    expect(backoffDelayMs(half, 3)).toBe(200)
  })

  it('never returns a negative or fractional delay', () => {
    const { policy } = recordingPolicy({ jitter: () => 0 })
    const delay = backoffDelayMs(policy, 0)
    expect(delay).toBeGreaterThanOrEqual(0)
    expect(Number.isInteger(delay)).toBe(true)
  })
})

describe('canRetry', () => {
  const { policy } = recordingPolicy()

  it('permits a retry inside the budget', () => {
    expect(canRetry(policy, 1, unavailable(), undefined)).toBe(true)
    expect(canRetry(policy, 2, unavailable(), undefined)).toBe(true)
  })

  it('refuses once the attempt budget is spent', () => {
    expect(canRetry(policy, 3, unavailable(), undefined)).toBe(false)
  })

  it('refuses a permanent fault', () => {
    expect(canRetry(policy, 1, rejected(), undefined)).toBe(false)
  })

  it('refuses once the caller has cancelled', () => {
    const controller = new AbortController()
    controller.abort()
    expect(canRetry(policy, 1, unavailable(), controller.signal)).toBe(false)
  })
})

describe('withRetry', () => {
  it('recovers when a later attempt succeeds', async () => {
    const { policy, waits } = recordingPolicy()
    const operation = jest
      .fn<Promise<string>, []>()
      .mockRejectedValueOnce(unavailable())
      .mockRejectedValueOnce(unavailable())
      .mockResolvedValue('third time')

    await expect(withRetry(policy, undefined, operation)).resolves.toBe('third time')
    expect(operation).toHaveBeenCalledTimes(3)
    expect(waits).toEqual([100, 200])
  })

  it('gives up after the budget and reports the last fault', async () => {
    const { policy, waits } = recordingPolicy({ maxAttempts: 3 })
    const operation = jest.fn<Promise<string>, []>().mockRejectedValue(unavailable())

    // Three attempts means two waits: the budget is on calls, not on pauses.
    await expect(withRetry(policy, undefined, operation)).rejects.toThrow(ModelProviderError)
    expect(operation).toHaveBeenCalledTimes(3)
    expect(waits).toHaveLength(2)
  })

  it('does not repeat a request the provider refused', async () => {
    const { policy, waits } = recordingPolicy()
    const operation = jest.fn<Promise<string>, []>().mockRejectedValue(rejected())

    await expect(withRetry(policy, undefined, operation)).rejects.toThrow(ModelProviderError)
    expect(operation).toHaveBeenCalledTimes(1)
    expect(waits).toEqual([])
  })

  it('treats a single permitted attempt as no retry at all', async () => {
    const { policy } = recordingPolicy({ maxAttempts: 1 })
    const operation = jest.fn<Promise<string>, []>().mockRejectedValue(unavailable())

    await expect(withRetry(policy, undefined, operation)).rejects.toThrow(ModelProviderError)
    expect(operation).toHaveBeenCalledTimes(1)
  })

  it('stops retrying once the caller has cancelled', async () => {
    const { policy } = recordingPolicy()
    const controller = new AbortController()
    const operation = jest.fn<Promise<string>, []>().mockImplementation(() => {
      controller.abort()
      return Promise.reject(unavailable())
    })

    await expect(withRetry(policy, controller.signal, operation)).rejects.toThrow(ModelProviderError)
    expect(operation).toHaveBeenCalledTimes(1)
  })

  it('never retries across providers', async () => {
    // The policy can only repeat the same call; selection is config-time and a dead
    // provider must surface rather than be quietly swapped for another model.
    const { policy } = recordingPolicy({ maxAttempts: 3 })
    const operation = jest.fn<Promise<string>, []>().mockRejectedValue(unavailable())

    await expect(withRetry(policy, undefined, operation)).rejects.toThrow(
      'The content model is unavailable. Try again shortly.',
    )
  })
})

describe('defaultRetryPolicy', () => {
  it('spends at most four seconds on any single wait', () => {
    const policy = defaultRetryPolicy()
    expect(policy.maxDelayMs).toBeLessThanOrEqual(4_000)
    for (const attempt of [0, 1, 5, 20]) {
      expect(backoffDelayMs(policy, attempt)).toBeLessThanOrEqual(4_000)
    }
  })

  it('keeps jitter inside the unit interval, so a delay can never go negative', () => {
    const policy = defaultRetryPolicy()
    for (let sample = 0; sample < 200; sample += 1) {
      expect(backoffDelayMs(policy, 2)).toBeGreaterThanOrEqual(0)
    }
  })

  it('takes its budget from configuration', () => {
    const policy = defaultRetryPolicy({ maxAttempts: 5, baseDelayMs: 10, maxDelayMs: 20 })
    expect(policy.maxAttempts).toBe(5)
    expect(backoffDelayMs(policy, 3)).toBeLessThanOrEqual(20)
  })
})