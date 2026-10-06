/**
 * Auth API — the live implementation.
 *
 * Every call goes through the shared, contract-validated client, so request and
 * response shapes are checked against `@dme/contracts` at runtime as well as at
 * compile time. Failure codes are translated once here into the codes the login
 * form renders, which keeps `ApiError` out of the UI.
 */

import { ApiError } from '@dme/contracts/http'
import type { SignInCredentials, AuthErrorCode } from '@/features/auth/types/auth.types'
import type { SessionUser } from '@/stores/authStore'
import { apiClient } from '@/lib/api/apiClient'

/** Matches the server-side rule in `PlainPassword`. */
export const MIN_PASSWORD_LENGTH = 8

export async function signInRequest(credentials: SignInCredentials): Promise<{
  user: SessionUser
  accessToken: string
  refreshToken: string
}> {
  const session = await apiClient.call('auth.signIn', {
    body: { email: credentials.email.trim(), password: credentials.password },
  })

  return {
    user: {
      id: session.user.id,
      email: session.user.email,
      fullName: session.user.fullName,
      role: session.user.role,
    },
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
  }
}

export async function signOutRequest(refreshToken: string | null): Promise<void> {
  // The local session is cleared either way; a failed request only means the
  // server already forgot it.
  if (refreshToken !== null) {
    try {
      await apiClient.call('auth.signOut', { body: { refreshToken } })
    } catch (error) {
      if (!(error instanceof ApiError)) throw error
    }
  }
}

/** Maps a transport failure onto the code the login form knows how to translate. */
export function toAuthErrorCode(error: unknown): AuthErrorCode {
  if (!(error instanceof ApiError)) return 'network'

  switch (error.code) {
    case 'invalid_credentials':
      return 'invalidCredentials'
    case 'forbidden':
      return 'userInactive'
    case 'validation_failed':
      return 'invalidCredentials'
    default:
      return 'network'
  }
}