import { ConflictError, ValidationError } from '../domain/domain.errors'
import type { IdempotencyStore, IdempotentResponse } from '../application/ports/idempotency-store.port'
import {
  assertSameRequest,
  fingerprint,
  findReplay,
  isReplayable,
  parseKey,
  recordIfSuccessful,
} from './idempotency'

/** Records what it was asked, so the policy can be asserted rather than inferred. */
class FakeStore implements IdempotencyStore {
  public readonly seen: Array<{ scope: string; key: string }> = []
  private readonly rows = new Map<string, IdempotentResponse>()

  public constructor(private readonly existing: IdempotentResponse | null = null) {}

  public async find(scope: string, key: string): Promise<IdempotentResponse | null> {
    this.seen.push({ scope, key })
    return this.existing ?? this.rows.get(`${scope}:${key}`) ?? null
  }

  public async remember(
    scope: string,
    key: string,
    response: IdempotentResponse,
  ): Promise<{ response: IdempotentResponse; inserted: boolean }> {
    const id = `${scope}:${key}`
    const stored = this.existing ?? this.rows.get(id)
    if (stored !== undefined) return { response: stored, inserted: false }
    this.rows.set(id, response)
    return { response, inserted: true }
  }

  public stored(scope: string, key: string): IdempotentResponse | null {
    return this.rows.get(`${scope}:${key}`) ?? null
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
    const store = new FakeStore(recorded)
    await expect(findReplay(store, 'user-1', 'k1', 'abc123')).resolves.toEqual(recorded)
  })

  it('refuses to replay a key that was used for a different request', async () => {
    const store = new FakeStore(recorded)
    await expect(findReplay(store, 'user-1', 'k1', 'different')).rejects.toThrow(ConflictError)
  })
})

describe('recordIfSuccessful', () => {
  it('records a success and leaves the caller to answer with its own response', async () => {
    const store = new FakeStore()
    await expect(
      recordIfSuccessful(store, 'user-1', 'k1', 'digest', 201, { id: 'campaign-1' }),
    ).resolves.toBeNull()
    expect(store.stored('user-1', 'k1')).toEqual({
      fingerprint: 'digest',
      statusCode: 201,
      body: { id: 'campaign-1' },
    })
  })

  it('records a 200', async () => {
    const store = new FakeStore()
    await recordIfSuccessful(store, 'user-1', 'k1', 'digest', 200, { ok: true })
    expect(store.stored('user-1', 'k1')?.statusCode).toBe(200)
  })

  // The property the whole mechanism rests on: a failed attempt must stay retryable.
  it('does not record a failure, so the same key can be retried', async () => {
    const store = new FakeStore()
    await expect(
      recordIfSuccessful(store, 'user-1', 'k1', 'digest', 503, { error: 'unavailable' }),
    ).resolves.toBeNull()
    expect(store.stored('user-1', 'k1')).toBeNull()
  })

  it('does not record a redirect', async () => {
    const store = new FakeStore()
    await recordIfSuccessful(store, 'user-1', 'k1', 'digest', 302, null)
    expect(store.stored('user-1', 'k1')).toBeNull()
  })

  it('hands back the winner response when the key was already taken', async () => {
    const store = new FakeStore(recorded)
    await expect(
      recordIfSuccessful(store, 'user-1', 'k1', 'abc123', 201, { id: 'campaign-mine' }),
    ).resolves.toEqual(recorded)
  })

  it('keeps keys separate per caller', async () => {
    const store = new FakeStore()
    await recordIfSuccessful(store, 'user-1', 'k1', 'digest', 201, { id: 'a' })
    await recordIfSuccessful(store, 'user-2', 'k1', 'digest', 201, { id: 'b' })
    expect(store.stored('user-1', 'k1')?.body).toEqual({ id: 'a' })
    expect(store.stored('user-2', 'k1')?.body).toEqual({ id: 'b' })
  })
})