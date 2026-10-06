import type { User } from '../../domain/user.entity'

/**
 * Driving port: everything the application layer needs from the outside world for
 * authentication. Adapters (TypeORM, bcrypt, JWT) implement these interfaces; the
 * use cases depend only on the interfaces, which is what keeps the domain
 * framework-free and unit-testable with plain fakes.
 */

/** A user together with the material only authentication needs. */
export interface CredentialsRecord {
  readonly user: User
  readonly passwordHash: string
}

/** Drives user lookup. Implemented by the TypeORM adapter. */
export interface UserRepository {
  findCredentialsByEmail(email: string): Promise<CredentialsRecord | null>
  findById(id: string): Promise<User | null>
  existsByEmail(email: string): Promise<boolean>
  count(): Promise<number>
}

/** Drives password hashing. Implemented by the bcrypt adapter. */
export interface PasswordHasher {
  hash(plain: string): Promise<string>
  verify(plain: string, hash: string): Promise<boolean>
}

export interface AccessTokenClaims {
  readonly sub: string
  readonly email: string
  readonly role: string
}

export interface RefreshTokenClaims {
  /** Identifies one issued token. Minted by the service, never by a caller. */
  readonly jti: string
  readonly sub: string
}

/** What a caller supplies: the account. The token identity is the service's job. */
export type RefreshTokenSubject = Omit<RefreshTokenClaims, 'jti'>

/** Issues and verifies tokens. Implemented by the JWT adapter. */
export interface TokenService {
  issueAccessToken(claims: AccessTokenClaims): { token: string; expiresIn: number }
  issueRefreshToken(claims: RefreshTokenSubject): { token: string; expiresIn: number }
  verifyAccessToken(token: string): AccessTokenClaims
  verifyRefreshToken(token: string): RefreshTokenClaims
  /** One-way digest used to index a session row without storing the token. */
  hashRefreshToken(token: string): string
}

/** A persisted refresh-token session. */
export interface StoredSession {
  readonly id: string
  readonly userId: string
  readonly tokenHash: string
  readonly expiresAt: Date
  readonly revokedAt: Date | null
}

export interface SessionRepository {
  create(session: { userId: string; tokenHash: string; expiresAt: Date; userAgent: string | null }): Promise<StoredSession>
  findActiveByTokenHash(tokenHash: string): Promise<StoredSession | null>
  revoke(id: string): Promise<void>
  revokeAllForUser(userId: string): Promise<void>
  deleteExpired(now: Date): Promise<number>
}