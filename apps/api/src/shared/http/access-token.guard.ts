import { Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { AuthenticateAccessToken } from '../../modules/auth/application/use-cases/auth.use-cases'
import {
  IS_PUBLIC,
  type AuthenticatedRequest,
} from './authenticated-request'
import { UnauthenticatedError } from '../domain/domain.errors'

/**
 * Applied to every route. Public routes opt out with `@Public()`; the rest need a
 * bearer token whose principal is attached to the request for `@CurrentUser`.
 *
 * The guard itself contains no verification logic — it delegates to a use case,
 * which keeps the security rules testable without an HTTP layer.
 */
@Injectable()
export class AccessTokenGuard implements CanActivate {
  public constructor(
    private readonly reflector: Reflector,
    private readonly authenticate: AuthenticateAccessToken,
  ) {}

  public async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ])
    if (isPublic === true) return true

    const request = context.switchToHttp().getRequest<AuthenticatedRequest & { headers: Record<string, string | undefined> }>()
    const token = this.readBearerToken(request.headers.authorization)
    if (token === null) throw new UnauthenticatedError()

    const claims = await this.authenticate.execute(token)
    request.user = { id: claims.sub, email: claims.email, role: claims.role }
    return true
  }

  private readBearerToken(header: string | undefined): string | null {
    if (header === undefined) return null
    const [scheme, value] = header.split(' ')
    if (scheme?.toLowerCase() !== 'bearer' || value === undefined || value.length === 0) return null
    return value
  }
}