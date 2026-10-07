import { ConflictError, ValidationError } from '../domain/domain.errors'
import type { IdempotencyStore, IdempotentResponse, IdempotencyClaim, IdempotencyStatus } from '../application/ports/idempotency-store.port'
import {
  assertSameRequest,
  coordinate,
  fingerprint,
  findReplay,
  isReplayable,
  parseKey,
} from './idempotency'

interface FakeRow {
  readonly id: string
  status: 'processing' | 'completed'
  fingerprint: string
  statusCode: number | null
  body: unknown
  readonly createdAt: Date
}

/** In-memory store with the same unique-index claim semantics as the real one. */
class FakeStore implements IdempotencyStore {
  private readonly rows = new Map<string, FakeRow>()
  private nextId = 0

  public constructor(initial: Array<[string, FakeRow]> = []) {
    for (const [key, row] of initial) this.rows.set(key, row)
  }

  public async find(scope: string, key: string): Promise<IdempotentResponse | null> {
    const row = this.rows.get(this.address(scope, key))
    if (row === undefined || row.status !== 'completed') return null
    return this.toResponse(row)
  }

  public async claim(scope: string, key: string, fingerprint: string): Promise<IdempotencyClaim> {
    const address = this.address(scope, key)
    const existing = this.rows.get(address)
    if (existing !== undefined) {
      if (existing.status === 'completed') {
        return { owner: false, completed: this.toResponse(existing), processingSince: null, id: null }
      }
      return { owner: false, completed: null, processingSince: existing.createdAt, id: null }
    }
    const row: FakeRow = {
      id: `row-${++this.nextId}`,
      status: 'processing',
      fingerprint,
      statusCode: null,
      body: null,
      createdAt: new Date(),
    }
    this.rows.set(address, row)
    return { owner: true, completed: null, processingSince: null, id: row.id }
  }

  public async statusOf(scope: string, key: string): Promise<IdempotencyStatus> {
    const row = this.rows.get(this.address(scope, key))
    if (row === undefined) return { state: 'absent' }
    if (row.status === 'processing') {
      return { state: 'processing', fingerprint: row.fingerprint, processingSince: row.createdAt }
    }
    return { state: 'completed', response: this.toResponse(row) }
  }

  public async complete(
    scope: string,
    key: string,
    id: string,
    response: IdempotentResponse,
  ): Promise<void> {
    const row = this.rows.get(this.address(scope, key))
    if (row === undefined || row.id !== id || row.status !== 'processing') return
    row.status = 'completed'
    row.fingerprint = response.fingerprint
    row.statusCode = response.statusCode
    row.body = response.body
  }

  public async release(scope: string, key: string, id?: string): Promise<void> {
    const row = this.rows.get(this.address(scope, key))
    if (row === undefined || row.status !== 'processing') return
    if (id !== undefined && row.id !== id) return
    this.rows.delete(this.address(scope, key))
  }

  public async prune(_now: Date): Promise<number> {
    return 0
  }

  public stored(scope: string, key: string): IdempotentResponse | null {
    const row = this.rows.get(this.address(scope, key))
    return row === undefined || row.status !== 'completed' ? null : this.toResponse(row)
  }

  public seedProcessing(scope: string, key: string, fingerprint: string, ageMs: number): void {
    this.rows.set(this.address(scope, key), {
      id: `row-${++this.nextId}`,
      status: 'processing',
      fingerprint,
      statusCode: null,
      body: null,
      createdAt: new Date(Date.now() - ageMs),
    })
  }

  private toResponse(row: FakeRow): IdempotentResponse {
    return { fingerprint: row.fingerprint, statusCode: row.statusCode as number, body: row.body as IdempotentResponse['body'] }
  }

  private address(scope: string, key: string): string {
    return `${scope}:${key}`
  }
}

const recorded: IdempotentResponse = {
  fingerprint: 'abc123',
  statusCode: 201,
  body: { id: 'campaign-1' },
}

describe('isReplayable', () => {
  it.each([200, 201, 202, 204, 299])('accepts %i', (statusCode) => {
    expect(isReplayable(statusCode)).toBe(true)
  })

  // A recorded failure would replay the failure forever and burn the key, which is
  // the opposite of what makes a retry safe.
  it.each([199, 300, 400, 409, 500, 503])('rejects %i', (statusCode) => {
    expect(isReplayable(statusCode)).toBe(false)
  })
})

describe('parseKey', () => {
  it('returns null when the client did not ask for replay', () => {
    expect(parseKey(undefined)).toBeNull()
  })

  it('returns null for a header present but empty', () => {
    expect(parseKey('')).toBeNull()
    expect(parseKey('   ')).toBeNull()
  })

  it('accepts a normal key', () => {
    expect(parseKey('8f1c2b1e-1f4a-4f0e-9a2b-6f0d1c2b3a4d')).toBe('8f1c2b1e-1f4a-4f0e-9a2b-6f0d1c2b3a4d')
  })

  it('accepts the full printable ASCII range the pattern allows', () => {
    expect(parseKey('a-b_c.d~e+f/g:h=i')).toBe('a-b_c.d~e+f/g:h=i')
  })

  it('rejects a key that cannot survive a header round trip', () => {
    expect(() => parseKey('has space')).toThrow(ValidationError)
  })

  it('rejects a key long enough to be a way to fill the table', () => {
    expect(() => parseKey('k'.repeat(256))).toThrow(ValidationError)
  })

  it('rejects non-ASCII rather than silently mangling it', () => {
    expect(() => parseKey('café')).toThrow(ValidationError)
  })

  it('names the offending header so the client can find it', () => {
    try {
      parseKey('has space')
      fail('expected a validation error')
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError)
      expect((error as ValidationError).fieldErrors).toHaveProperty('idempotency-key')
    }
  })
})

describe('fingerprint', () => {
  it('is stable for the same request', () => {
    expect(fingerprint('POST', '/campaigns/generate', { a: 1 })).toBe(
      fingerprint('POST', '/campaigns/generate', { a: 1 }),
    )
  })

  it('ignores JSON key order, so a retry through a different serializer still matches', () => {
    expect(fingerprint('POST', '/x', { a: 1, b: 2 })).toBe(fingerprint('POST', '/x', { b: 2, a: 1 }))
  })

  it('preserves array order, which is meaningful', () => {
    expect(fingerprint('POST', '/x', { a: [1, 2] })).not.toBe(fingerprint('POST', '/x', { a: [2, 1] }))
  })

  it('distinguishes a changed field', () => {
    expect(fingerprint('POST', '/x', { a: 1 })).not.toBe(fingerprint('POST', '/x', { a: 2 }))
  })

  it('distinguishes a changed path', () => {
    expect(fingerprint('POST', '/x', { a: 1 })).not.toBe(fingerprint('POST', '/y', { a: 1 }))
  })

  it('distinguishes a changed method', () => {
    expect(fingerprint('POST', '/x', {})).not.toBe(fingerprint('PUT', '/x', {}))
  })

  it('distinguishes a body that only differs by an explicit null', () => {
    expect(fingerprint('POST', '/x', { a: null })).not.toBe(fingerprint('POST', '/x', {}))
  })

  it('is a hex sha256 digest', () => {
    expect(fingerprint('POST', '/x', {})).toMatch(/^[0-9a-f]{64}$/)
  })
})

describe('assertSameRequest', () => {
  it('passes when the digest matches', () => {
    expect(() => {
      assertSameRequest('same', 'same')
    }).not.toThrow()
  })

  it('rejects a key reused for a different request', () => {
    expect(() => {
      assertSameRequest('first', 'second')
    }).toThrow(ConflictError)
  })
})

describe('findReplay', () => {
  it('returns null for the first use of a key', async () => {
    const store = new FakeStore()
    await expect(findReplay(store, 'user-1', 'k1', 'digest')).resolves.toBeNull()
  })

  it('returns the recorded response when the request matches', async () => {
    const store = new FakeStore()
    const claim = await store.claim('user-1', 'k1', 'abc123')
    await store.complete('user-1', 'k1', claim.id as string, recorded)
    await expect(findReplay(store, 'user-1', 'k1', 'abc123')).resolves.toEqual(recorded)
  })

  it('ignores a processing row, which is not a finished answer', async () => {
    const store = new FakeStore()
    store.seedProcessing('user-1', 'k1', 'abc123', 0)
    await expect(findReplay(store, 'user-1', 'k1', 'abc123')).resolves.toBeNull()
  })

  it('refuses to replay a key that was used for a different request', async () => {
    const store = new FakeStore()
    const claim = await store.claim('user-1', 'k1', 'abc123')
    await store.complete('user-1', 'k1', claim.id as string, recorded)
    await expect(findReplay(store, 'user-1', 'k1', 'different')).rejects.toThrow(ConflictError)
  })
})

describe('coordinate', () => {
  const run = (store: IdempotencyStore, overrides: Partial<{ statusCode: number }> = {}) => {
    let calls = 0
    const attempt = {
      store,
      scope: 'user-1',
      key: 'k1',
      digest: 'digest',
      execute: async () => {
        calls += 1
        return { statusCode: overrides.statusCode ?? 201, body: { id: `campaign-${calls}` } }
      },
    }
    return { attempt, calls: () => calls }
  }

  const fast = { pollIntervalMs: 5, waitTimeoutMs: 250, staleAfterMs: 50 }

  it('runs the first use of a key and records the response', async () => {
    const store = new FakeStore()
    const { attempt } = run(store)
    const outcome = await coordinate(store, attempt)
    expect(outcome).toEqual({ replay: false, statusCode: 201, body: { id: 'campaign-1' } })
    expect(store.stored('user-1', 'k1')).toEqual({ fingerprint: 'digest', statusCode: 201, body: { id: 'campaign-1' } })
  })

  it('answers a repeated identical request with a replay, without running it again', async () => {
    const store = new FakeStore()
    const { attempt, calls } = run(store)
    await coordinate(store, attempt)
    const replay = await coordinate(store, attempt)
    expect(replay).toEqual({ replay: true, statusCode: 201, body: { id: 'campaign-1' } })
    expect(calls()).toBe(1)
  })

  it('rejects a key reused for a different request', async () => {
    const store = new FakeStore()
    const { attempt } = run(store)
    await coordinate(store, attempt)
    await expect(coordinate(store, { ...attempt, digest: 'other' })).rejects.toThrow(ConflictError)
  })

  it('frees the key when the handler fails, so the retry runs again', async () => {
    const store = new FakeStore()
    const { attempt } = run(store)
    const failing = {
      ...attempt,
      execute: async () => {
        throw new Error('model unavailable')
      },
    }
    await expect(coordinate(store, failing)).rejects.toThrow('model unavailable')
    expect(store.stored('user-1', 'k1')).toBeNull()
    const retried = await coordinate(store, attempt)
    expect(retried.replay).toBe(false)
  })

  it('does not record a non-replayable status, keeping the key retryable', async () => {
    const store = new FakeStore()
    const { attempt } = run(store, { statusCode: 503 })
    await coordinate(store, attempt)
    expect(store.stored('user-1', 'k1')).toBeNull()
  })

  it('converges two concurrent requests on one execution and one answer', async () => {
    const store = new FakeStore()
    const callA = () => new Promise((resolve) => setTimeout(resolve, 20))
    let executions = 0
    const make = () =>
      coordinate(store, {
        scope: 'user-1',
        key: 'k1',
        digest: 'digest',
        execute: async () => {
          executions += 1
          await callA()
          return { statusCode: 201, body: { id: `campaign-${executions}` } }
        },
      }, fast)

    const [a, b] = await Promise.all([make(), make()])
    // Exactly one request ran the costly handler, whichever claimed first.
    expect(executions).toBe(1)
    expect([a.replay, b.replay].filter(Boolean).length).toBe(1)
    expect(a.body).toEqual(b.body)
  })

  it('takes over a claim whose owner never finished', async () => {
    const store = new FakeStore()
    // A claim left processing long past the staleness threshold, as though the owner
    // died mid-flight.
    store.seedProcessing('user-1', 'k1', 'digest', 10_000)
    const { attempt } = run(store)
    const outcome = await coordinate(store, attempt, fast)
    expect(outcome.replay).toBe(false)
    expect(store.stored('user-1', 'k1')?.body).toEqual({ id: 'campaign-1' })
  })

  it('reports an ongoing request after the wait window instead of looping forever', async () => {
    const store = new FakeStore()
    store.seedProcessing('user-1', 'k1', 'digest', 0)
    const { attempt } = run(store)
    await expect(coordinate(store, attempt, { ...fast, staleAfterMs: 5_000, waitTimeoutMs: 30 })).rejects.toThrow(
      ConflictError,
    )
  })
})