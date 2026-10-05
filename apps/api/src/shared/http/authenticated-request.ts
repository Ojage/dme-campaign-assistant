import { SetMetadata, createParamDecorator, type CustomDecorator, type ExecutionContext } from '@nestjs/common'

export interface AuthenticatedUser {
  readonly id: string
  readonly email: string
  readonly role: string
}

/** Request shape after `AccessTokenGuard` has run. */
export interface AuthenticatedRequest {
  user?: AuthenticatedUser
}

export const IS_PUBLIC = 'isPublic'

/** Opts a route out of the globally registered access-token guard. */
export const Public = (): CustomDecorator<string> => SetMetadata(IS_PUBLIC, true)

/**
 * Injects the authenticated principal. Routes using it must not be public — the
 * guard runs first, so a missing user is a programming error, not a runtime case.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>()
    const user = request.user
    if (user === undefined) {
      throw new Error('@CurrentUser was used on a route that is not authenticated')
    }
    return user
  },
)