export type AuthStatus = 'loading' | 'authenticated' | 'anonymous'

export interface SessionUser {
  id: string
  fullName: string
  email: string
  role: string
}

export interface SignInCredentials {
  email: string
  password: string
}

/** Machine-readable failure codes; the UI maps these to i18n keys. */
export type AuthErrorCode = 'userNotFound' | 'invalidCredentials' | 'userInactive' | 'network'

export class AuthApiError extends Error {
  readonly code: AuthErrorCode

  constructor(code: AuthErrorCode) {
    super(code)
    this.name = 'AuthApiError'
    this.code = code
  }
}

export function toAuthErrorCode(error: unknown): AuthErrorCode {
  return error instanceof AuthApiError ? error.code : 'network'
}
