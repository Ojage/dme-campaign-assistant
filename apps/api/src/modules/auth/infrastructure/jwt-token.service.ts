import { Inject, Injectable } from '@nestjs/common'
import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import type {
  AccessTokenClaims,
  RefreshTokenClaims,
  TokenService,
} from '../application/ports/auth.ports'
import { ENV } from '../../../config/env'
import type { AppConfig } from '../../../config/env'

interface AccessTokenPayload {
  readonly sub: string
  readonly email: string
  readonly role: string
  readonly exp: number
  readonly iat: number
  readonly typ: 'access'
}

interface RefreshTokenPayload {
  readonly sub: string
  readonly jti: string
  readonly exp: number
  readonly iat: number
  readonly typ: 'refresh'
}

/**
 * Compact HS256 JWT adapter, implemented directly so the signing scheme is
 * auditable in one file. Access and refresh tokens are signed with different
 * secrets and carry a `typ` claim, so neither can be replayed as the other.
 */
@Injectable()
export class JwtTokenService implements TokenService {
  public constructor(@Inject(ENV) private readonly config: AppConfig) {}

  public issueAccessToken(claims: AccessTokenClaims): { token: string; expiresIn: number } {
    return this.sign(claims, this.config.jwt.accessSecret, 'access', this.config.jwt.accessTtl)
  }

  public issueRefreshToken(claims: RefreshTokenClaims): { token: string; expiresIn: number } {
    return this.sign(
      { sub: claims.sub, jti: claims.jti },
      this.config.jwt.refreshSecret,
      'refresh',
      this.config.jwt.refreshTtl,
    )
  }

  public verifyAccessToken(token: string): AccessTokenClaims {
    const payload = this.verify<AccessTokenPayload>(token, this.config.jwt.accessSecret)
    if (payload.typ !== 'access') throw new Error('Wrong token type')
    return { sub: payload.sub, email: payload.email, role: payload.role }
  }

  public verifyRefreshToken(token: string): RefreshTokenClaims {
    const payload = this.verify<RefreshTokenPayload>(token, this.config.jwt.refreshSecret)
    if (payload.typ !== 'refresh') throw new Error('Wrong token type')
    return { sub: payload.sub, jti: payload.jti }
  }

  public hashRefreshToken(token: string): string {
    // SHA-256 is fine here: refresh tokens are high-entropy random strings, not
    // user-chosen passwords, so there is nothing to brute-force.
    return createHash('sha256').update(token).digest('hex')
  }

  private sign(
    payload: object,
    secret: string,
    typ: 'access' | 'refresh',
    ttlSeconds: number,
  ): { token: string; expiresIn: number } {
    const issuedAt = Math.floor(Date.now() / 1000)
    const header = this.base64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
    const claims = this.base64Url(JSON.stringify({ ...payload, typ, iat: issuedAt, exp: issuedAt + ttlSeconds }))
    const signature = createHmac('sha256', secret).update(`${header}.${claims}`).digest('base64url')
    return { token: `${header}.${claims}.${signature}`, expiresIn: ttlSeconds }
  }

  private verify<TPayload extends { exp: number }>(token: string, secret: string): TPayload {
    const parts = token.split('.')
    if (parts.length !== 3) throw new Error('Malformed token')
    const [header, claims, signature] = parts as [string, string, string]

    const expected = createHmac('sha256', secret).update(`${header}.${claims}`).digest()
    const provided = Buffer.from(signature, 'base64url')
    if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
      throw new Error('Invalid signature')
    }

    const payload = JSON.parse(Buffer.from(claims, 'base64url').toString('utf8')) as TPayload
    if (typeof payload.exp !== 'number' || payload.exp * 1000 <= Date.now()) {
      throw new Error('Token expired')
    }
    return payload
  }

  private base64Url(value: string): string {
    return Buffer.from(value, 'utf8').toString('base64url')
  }
}