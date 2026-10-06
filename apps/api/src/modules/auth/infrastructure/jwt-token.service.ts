import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto'
import type { AppConfig } from '../../../config/env'
import type { RefreshTokenClaims, RefreshTokenSubject } from '../application/ports/auth.ports'

/**
 * Compact HS256 token service, implemented directly so the signing scheme is
 * auditable in one file.
 *
 * It has no Nest dependency: `Injectable()` is applied by the module that binds it,
 * which is what lets the signing rules be tested here rather than only through a
 * container. Keeping the class framework-free also means a caller cannot reach the
 * signing keys by accident from a unit test.
 */
export class JwtTokenService {
  public constructor(private readonly config: AppConfig) {}

  public issueAccessToken(claims: {
    sub: string
    email: string
    role: string
  }): { token: string; expiresIn: number } {
    return this.sign(claims, this.config.jwt.accessSecret, 'access', this.config.jwt.accessTtl)
  }

  /**
   * `jti` is minted here rather than taken from the caller because it is what makes
   * two tokens distinguishable. Deriving it from the user and the issue time — both
   * of which repeat — produced byte-identical refresh tokens for two sign-ins in the
   * same second, and the unique index on the stored hash turned the second into a
   * 500. `sub` alone identifies the account, which is the caller's concern.
   */
  public issueRefreshToken(claims: RefreshTokenSubject): { token: string; expiresIn: number } {
    return this.sign(
      { sub: claims.sub, jti: randomUUID() },
      this.config.jwt.refreshSecret,
      'refresh',
      this.config.jwt.refreshTtl,
    )
  }

  public verifyAccessToken(token: string): { sub: string; email: string; role: string } {
    const payload = this.verify<{ typ: string; sub: string; email: string; role: string }>(
      token,
      this.config.jwt.accessSecret,
    )
    if (payload.typ !== 'access') throw new Error('Wrong token type')
    return { sub: payload.sub, email: payload.email, role: payload.role }
  }

  public verifyRefreshToken(token: string): RefreshTokenClaims {
    const payload = this.verify<{ typ: string; sub: string; jti: string }>(token, this.config.jwt.refreshSecret)
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

  private verify<TPayload>(token: string, secret: string): TPayload {
    const parts = token.split('.')
    if (parts.length !== 3) throw new Error('Malformed token')
    const [header, claims, signature] = parts as [string, string, string]

    const expected = createHmac('sha256', secret).update(`${header}.${claims}`).digest()
    const provided = Buffer.from(signature, 'base64url')
    if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
      throw new Error('Invalid signature')
    }

    const payload = JSON.parse(Buffer.from(claims, 'base64url').toString('utf8')) as TPayload & { exp?: unknown }
    if (typeof payload.exp !== 'number' || payload.exp * 1000 <= Date.now()) {
      throw new Error('Token expired')
    }
    return payload
  }

  private base64Url(value: string): string {
    return Buffer.from(value, 'utf8').toString('base64url')
  }
}