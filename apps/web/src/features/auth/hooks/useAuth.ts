import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { signInRequest, signOutRequest, toAuthErrorCode } from '@/features/auth/api/authApi'
import type { AuthErrorCode, SignInCredentials } from '@/features/auth/types/auth.types'
import { useAuthStore } from '@/stores/authStore'

/**
 * Reads and commands the authentication store.
 *
 * The state lives in Zustand rather than in this hook, because the HTTP client
 * also needs the tokens. Two selectors mean a component re-renders only for the
 * slice it reads, instead of on every store write.
 */
export function useAuth() {
  const status = useAuthStore((state) => state.status)
  const user = useAuthStore((state) => state.user)
  const signOut = useSignOut()

  const signIn = useCallback(async (credentials: SignInCredentials): Promise<AuthErrorCode | null> => {
    try {
      const session = await signInRequest(credentials)
      useAuthStore.getState().setSession(session)
      return null
    } catch (error) {
      // The form renders a code, so failures never escape as exceptions.
      return toAuthErrorCode(error)
    }
  }, [])

  return { user, status, signIn, signOut }
}

/** Clears the session and every cached query, so no data survives a sign-out. */
export function useSignOut() {
  const queryClient = useQueryClient()

  return useCallback(async () => {
    const refreshToken = useAuthStore.getState().refreshToken
    await signOutRequest(refreshToken)
    useAuthStore.getState().clear()
    queryClient.clear()
  }, [queryClient])
}
