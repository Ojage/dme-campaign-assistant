import { Body, Controller, Headers, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common'
import { credentialsSchema, refreshTokenSchema } from '@dme/contracts'
import { SignIn, RefreshSession, SignOut } from '../../application/use-cases/auth.use-cases'
import type { SessionResult, SessionUser } from '../../application/use-cases/auth.use-cases'
import { zodBody } from '../../../../shared/http/zod-validation.pipe'
import { Public } from '../../../../shared/http/authenticated-request'
import { RateLimit, RateLimitGuard } from '../../../../shared/http/rate-limit.guard'

/**
 * Wire representation of a user. `Date` values are serialised by Nest's JSON
 * transformer, and the shared contract declares them as ISO strings.
 */
interface UserResponse {
  id: string
  email: string
  fullName: string
  role: string
  isActive: boolean
  createdAt: string
}

function toUserResponse(user: SessionUser): UserResponse {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt.toISOString(),
  }
}

function toSessionResponse(result: SessionResult) {
  return {
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
    expiresIn: result.expiresIn,
    user: toUserResponse(result.user),
  }
}

/**
 * HTTP adapter for authentication. It translates requests into use-case calls and
 * use-case results into response bodies — no business rules live here.
 */
@Controller('auth')
export class AuthController {
  public constructor(
    private readonly signIn: SignIn,
    private readonly refreshSession: RefreshSession,
    private readonly signOut: SignOut,
  ) {}

  @Public()
  @RateLimit('sign-in')
  @UseGuards(RateLimitGuard)
  @Post('sign-in')
  @HttpCode(HttpStatus.OK)
  public async signInEndpoint(
    @Body(zodBody(credentialsSchema)) body: { email: string; password: string },
    @Headers('user-agent') userAgent: string | undefined,
  ) {
    return toSessionResponse(await this.signIn.execute({ email: body.email, password: body.password, userAgent: userAgent ?? null }))
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  public async refresh(@Body(zodBody(refreshTokenSchema)) body: { refreshToken: string }) {
    const refreshed = await this.refreshSession.execute(body.refreshToken)
    return {
      accessToken: refreshed.accessToken,
      // The presented token has just been revoked, so the client is given the
      // replacement. Without it the client keeps a token that can never refresh.
      refreshToken: refreshed.refreshToken,
      expiresIn: refreshed.expiresIn,
      user: toUserResponse(refreshed.user),
    }
  }

  @Post('sign-out')
  @HttpCode(HttpStatus.NO_CONTENT)
  public async signOutEndpoint(@Body(zodBody(refreshTokenSchema)) body: { refreshToken: string }): Promise<void> {
    await this.signOut.execute(body.refreshToken)
  }
}
