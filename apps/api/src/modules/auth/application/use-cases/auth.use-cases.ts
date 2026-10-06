import { Inject, Injectable } from '@nestjs/common'
import type { UserRole } from '../../domain/user.entity'
import type {
  AccessTokenClaims,
  PasswordHasher,
  RefreshTokenClaims,
  SessionRepository,
  TokenService,
  UserRepository,
} from '../ports/auth.ports'
import { AUTH_PORTS } from '../../auth.tokens'
import { InvalidCredentialsError, SessionExpiredError, UnauthenticatedError } from '../../../../shared/domain/domain.errors'

/** Everything the interface layer needs to answer an authentication request. */
export interface SessionUser {
  readonly id: string
  readonly email: string
  readonly fullName: string
  readonly role: UserRole
  readonly isActive: boolean
  readonly createdAt: Date
}

export interface SessionResult {
  readonly accessToken: string
  readonly refreshToken: string
  readonly expiresIn: number
  readonly user: SessionUser
}

export interface SignInCommand {
  readonly email: string
  readonly password: string
  readonly userAgent: string | null
}

/**
 * Exchanges credentials for a session.
 *
 * A missing account, a wrong password and a deactivated account all fail the same
 * way: the response must not tell an attacker which emails exist in the workspace.
 */
@Injectable()
export class SignIn {
  public constructor(
    @Inject(AUTH_PORTS.userRepository) private readonly users: UserRepository,
    @Inject(AUTH_PORTS.passwordHasher) private readonly hasher: PasswordHasher,
    @Inject(AUTH_PORTS.tokenService) private readonly tokens: TokenService,
    @Inject(AUTH_PORTS.sessionRepository) private readonly sessions: SessionRepository,
  ) {}

  public async execute(command: SignInCommand): Promise<SessionResult> {
    const record = await this.users.findCredentialsByEmail(command.email.trim().toLowerCase())
    if (record === null) throw new InvalidCredentialsError()

    const passwordMatches = await this.hasher.verify(command.password, record.passwordHash)
    if (!passwordMatches || !record.user.isActive) throw new InvalidCredentialsError()

    return this.startSession(record.user, command.userAgent)
  }

  private async startSession(
    user: { id: string; email: string; fullName: string; role: UserRole; isActive: boolean; createdAt: Date },
    userAgent: string | null,
  ): Promise<SessionResult> {
    const access = this.tokens.issueAccessToken({ sub: user.id, email: user.email, role: user.role })
    const refresh = this.tokens.issueRefreshToken({ sub: user.id })

    await this.sessions.create({
      userId: user.id,
      tokenHash: this.tokens.hashRefreshToken(refresh.token),
      expiresAt: new Date(Date.now() + refresh.expiresIn * 1000),
      userAgent,
    })

    return {
      accessToken: access.token,
      refreshToken: refresh.token,
      expiresIn: access.expiresIn,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt,
      },
    }
  }
}

/**
 * Exchanges a refresh token for a new session, rotating the stored token so a
 * leaked refresh token stops working as soon as the legitimate client refreshes.
 */
@Injectable()
export class RefreshSession {
  public constructor(
    @Inject(AUTH_PORTS.tokenService) private readonly tokens: TokenService,
    @Inject(AUTH_PORTS.sessionRepository) private readonly sessions: SessionRepository,
    @Inject(AUTH_PORTS.userRepository) private readonly users: UserRepository,
  ) {}

  public async execute(refreshToken: string): Promise<SessionResult> {
    const claims = this.readRefreshToken(refreshToken)

    const session = await this.sessions.findActiveByTokenHash(this.tokens.hashRefreshToken(refreshToken))
    if (session === null || session.expiresAt.getTime() <= Date.now()) {
      throw new SessionExpiredError()
    }

    const user = await this.users.findById(claims.sub)
    if (user === null || !user.isActive) {
      await this.sessions.revoke(session.id)
      throw new SessionExpiredError()
    }

    // Rotation: the presented token dies with the new session being issued.
    await this.sessions.revoke(session.id)

    const access = this.tokens.issueAccessToken({ sub: user.id, email: user.email, role: user.role })
    const refresh = this.tokens.issueRefreshToken({ sub: user.id })
    await this.sessions.create({
      userId: user.id,
      tokenHash: this.tokens.hashRefreshToken(refresh.token),
      expiresAt: new Date(Date.now() + refresh.expiresIn * 1000),
      userAgent: null,
    })

    return {
      accessToken: access.token,
      refreshToken: refresh.token,
      expiresIn: access.expiresIn,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt,
      },
    }
  }

  private readRefreshToken(refreshToken: string): RefreshTokenClaims {
    try {
      return this.tokens.verifyRefreshToken(refreshToken)
    } catch {
      throw new SessionExpiredError()
    }
  }
}

/** Revokes the presented session. Idempotent: signing out twice is not an error. */
@Injectable()
export class SignOut {
  public constructor(
    @Inject(AUTH_PORTS.tokenService) private readonly tokens: TokenService,
    @Inject(AUTH_PORTS.sessionRepository) private readonly sessions: SessionRepository,
  ) {}

  public async execute(refreshToken: string): Promise<void> {
    let tokenHash: string
    try {
      this.tokens.verifyRefreshToken(refreshToken)
      tokenHash = this.tokens.hashRefreshToken(refreshToken)
    } catch {
      // Already invalid, so there is nothing left to revoke.
      return
    }
    const session = await this.sessions.findActiveByTokenHash(tokenHash)
    if (session !== null) await this.sessions.revoke(session.id)
  }
}

/**
 * Used by the HTTP guard to turn a bearer token into a principal. Kept as a use
 * case so the guard itself holds no verification logic.
 */
@Injectable()
export class AuthenticateAccessToken {
  public constructor(
    @Inject(AUTH_PORTS.tokenService) private readonly tokens: TokenService,
    @Inject(AUTH_PORTS.userRepository) private readonly users: UserRepository,
  ) {}

  public async execute(accessToken: string): Promise<AccessTokenClaims> {
    let claims: AccessTokenClaims
    try {
      claims = this.tokens.verifyAccessToken(accessToken)
    } catch {
      throw new UnauthenticatedError()
    }

    // Confirm the account is still active: a token outlives a deactivation.
    const user = await this.users.findById(claims.sub)
    if (user === null || !user.isActive) throw new UnauthenticatedError()

    return claims
  }
}