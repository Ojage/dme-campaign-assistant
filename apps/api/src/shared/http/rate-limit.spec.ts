import { FixedWindowRateLimiter } from './rate-limit'

describe('FixedWindowRateLimiter', () => {
  const limiter = () => new FixedWindowRateLimiter({ windowMs: 1_000, max: 2 })

  it('allows up to the maximum calls within a window', () => {
    const bucket = limiter()
    expect(bucket.hit('a', 0).allowed).toBe(true)
    expect(bucket.hit('a', 100).allowed).toBe(true)
    expect(bucket.hit('a', 200).allowed).toBe(false)
  })

  it('keeps keys separate', () => {
    const bucket = limiter()
    bucket.hit('a', 0)
    bucket.hit('a', 1)
    expect(bucket.hit('b', 2).allowed).toBe(true)
    expect(bucket.hit('a', 3).allowed).toBe(false)
  })

  it('resets after the window elapses', () => {
    const bucket = limiter()
    bucket.hit('a', 0)
    bucket.hit('a', 100)
    expect(bucket.hit('a', 1_000).allowed).toBe(true)
  })

  it('reports how long the caller must wait, rounded up to a second', () => {
    const bucket = limiter()
    bucket.hit('a', 0)
    bucket.hit('a', 100)
    expect(bucket.hit('a', 600).retryAfterSeconds).toBe(1)
    expect(bucket.hit('b', 0)).toEqual({ allowed: true, retryAfterSeconds: 0 })
  })
})