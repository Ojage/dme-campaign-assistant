import type { ErrorCode } from '@dme/contracts'

/**
 * The domain's error taxonomy.
 *
 * The domain and application layers throw these and know nothing about HTTP. The
 * interface layer maps each one onto a status and a problem-details code, so
 * transport concerns stay out of the business rules.
 */
export abstract class DomainError extends Error {
  protected constructor(
    message: string,
    /** Machine-readable code from the shared contract. */
    public readonly code: ErrorCode,
    /** HTTP status used only by the interface layer mapping. */
    public readonly status: number,
    public readonly fieldErrors?: Readonly<Record<string, string[]>>,
    options?: { cause?: unknown },
  ) {
    super(message, options)
    this.name = new.target.name
  }
}

export class ValidationError extends DomainError {
  public constructor(
    message = 'The request payload is invalid.',
    fieldErrors?: Readonly<Record<string, string[]>>,
  ) {
    super(message, 'validation_failed', 400, fieldErrors)
  }
}

export class NotFoundError extends DomainError {
  public constructor(message = 'The requested resource does not exist.') {
    super(message, 'not_found', 404)
  }
}

export class ConflictError extends DomainError {
  public constructor(
    message = 'The resource already exists.',
    fieldErrors?: Readonly<Record<string, string[]>>,
  ) {
    super(message, 'conflict', 409, fieldErrors)
  }
}

export class UnauthenticatedError extends DomainError {
  public constructor(message = 'Sign in to continue.') {
    super(message, 'unauthenticated', 401)
  }
}

export class SessionExpiredError extends DomainError {
  public constructor(message = 'Your session has expired. Sign in again.') {
    super(message, 'session_expired', 401)
  }
}

export class ForbiddenError extends DomainError {
  public constructor(message = 'You do not have access to this resource.') {
    super(message, 'forbidden', 403)
  }
}

export class InvalidCredentialsError extends DomainError {
  public constructor(message = 'Those credentials are not valid.') {
    super(message, 'invalid_credentials', 401)
  }
}

export class InactiveAccountError extends DomainError {
  public constructor(message = 'This account has been deactivated.') {
    super(message, 'forbidden', 403)
  }
}

/** A downstream model provider failed or is not configured. */
export class ModelProviderError extends DomainError {
  public constructor(
    message = 'The content model is unavailable. Try again shortly.',
    code: Extract<ErrorCode, 'llm_unavailable' | 'llm_error'> = 'llm_unavailable',
    options?: { cause?: unknown },
  ) {
    super(message, code, 503, undefined, options)
  }
}