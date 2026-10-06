import { createHash, createHmac } from 'node:crypto'
import type { AppConfig } from '../../../config/env'
import { JwtTokenService } from './jwt-token.service'

const config = {
  jwt: { accessSecret: 'a'.repeat(48), refreshSecret: 'b'.repeat(48), accessTtl: 900, refreshTtl: 604_800 },
} as AppConfig

const tokens = new JwtTokenService(config)
const sub = '1ae682f4-ff6b-4299-827e-e974edd1fea4'

describe('JwtTokenService refresh tokens', () => {
  // The regression: `jti` was the user id and `iat` is whole seconds, so two
  // sign-ins in the same second produced an identical token. The session table
  // indexes the token hash uniquely, so the second insert raised and sign-in
  // answered 500.
  it('gives two refresh tokens for the same user different ids', () => {
    const first = tokens.issueRefreshToken({ sub })
    const second = tokens.issueRefreshToken({ sub })

    expect(first.token).not.toBe(second.token)
  })

  it('stays unique across many consecutive issues', () => {
    const issued = new Set<string>()
    for (let attempt = 0; attempt < 200; attempt += 1) {
      issued.add(tokens.hashRefreshToken(tokens.issueRefreshToken({ sub }).token))
    }
    expect(issued.size).toBe(200)
  })

  it('returns a fresh id per token, not one derived from the user', () => {
    const claims = tokens.verifyRefreshToken(tokens.issueRefreshToken({ sub }).token)
    expect(claims.jti).not.toBe(sub)
  })

  it('still reports the subject the caller asked for', () => {
    const claims = tokens.verifyRefreshToken(tokens.issueRefreshToken({ sub }).token)
    expect(claims.sub).toBe(sub)
  })

  it('verifies a token it issued', () => {
    const { token } = tokens.issueRefreshToken({ sub })
    expect(tokens.verifyRefreshToken(token).sub).toBe(sub)
  })

  it('rejects an access token presented as a refresh token', () => {
    const { token } = tokens.issueAccessToken({ sub, email: 'a@b.cm', role: 'member' })
    expect(() => tokens.verifyRefreshToken(token)).toThrow()
  })

  it('rejects a refresh token signed with the access secret', () => {
    const forged = ((): string => {
      const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' }), 'utf8').toString('base64url')
      const claims = Buffer.from(
        JSON.stringify({ sub, jti: 'x', typ: 'refresh', iat: 1, exp: Math.floor(Date.now() / 1000) + 600 }),
        'utf8',
      ).toString('base64url')
      // Signed with the *access* secret, so the refresh verification must fail.
      const signature = createHmac('sha256', config.jwt.accessSecret).update(`${header}.${claims}`).digest('base64url')
      return `${header}.${claims}.${signature}`
    })()

    expect(() => tokens.verifyRefreshToken(forged)).toThrow()
  })

  it('rejects a token whose signature was altered', () => {
    const { token } = tokens.issueRefreshToken({ sub })
    const [header, claims] = token.split('.') as [string, string, string]
    const tampered = `${header}.${claims}.${'A'.repeat(43)}`
    expect(() => tokens.verifyRefreshToken(tampered)).toThrow()
  })

  it('rejects an expired token', () => {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' }), 'utf8').toString('base64url')
    const claims = Buffer.from(
      JSON.stringify({ sub, jti: 'x', typ: 'refresh', iat: 1, exp: 2 }),
      'utf8',
    ).toString('base64url')
    const signature = createHmac('sha256', config.jwt.refreshSecret).update(`${header}.${claims}`).digest('base64url')

    expect(() => tokens.verifyRefreshToken(`${header}.${claims}.${signature}`)).toThrow('Token expired')
  })

  it('rejects a malformed token', () => {
    expect(() => tokens.verifyRefreshToken('not-a-token')).toThrow('Malformed token')
  })

  it('hashes a token deterministically, so the same token indexes the same session', () => {
    const { token } = tokens.issueRefreshToken({ sub })
    expect(tokens.hashRefreshToken(token)).toBe(createHash('sha256').update(token).digest('hex'))
  })
})

describe('JwtTokenService access tokens', () => {
  it('carries the claims the guard needs', () => {
    const { token, expiresIn } = tokens.issueAccessToken({ sub, email: 'a@b.cm', role: 'marketing_lead' })
    const claims = tokens.verifyAccessToken(token)

    expect(claims).toEqual({ sub, email: 'a@b.cm', role: 'marketing_lead' })
    expect(expiresIn).toBe(900)
  })

  it('rejects a refresh token presented as an access token', () => {
    const { token } = tokens.issueRefreshToken({ sub })
    expect(() => tokens.verifyAccessToken(token)).toThrow()
  })
})
