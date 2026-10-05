import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/** Mirrors `sessionUserSchema` in the shared contract. */
export interface SessionUser {
  readonly id: string
  readonly email: string
  readonly fullName: string
  readonly role: string
}

export type AuthStatus = 'loading' | 'authenticated' | 'anonymous'

interface AuthState {
  user: SessionUser | null
  accessToken: string | null
  refreshToken: string | null
  status: AuthStatus
  /** Set once the persisted session has been read from storage. */
  hydrated: boolean
  setSession: (session: { user: SessionUser; accessToken: string; refreshToken: string }) => void
  setTokens: (tokens: { accessToken?: string | null; refreshToken?: string | null }) => void
  /** Applied when a refresh fails, so the app drops to the login screen. */
  clear: () => void
  markHydrated: () => void
}

/**
 * The single owner of authentication state.
 *
 * Zustand rather than context because the HTTP client needs the tokens outside
 * React: it reads them on every request and writes a rotated access token back
 * after a refresh. Both are plain reads and writes on this store, no context
 * plumbing through the tree.
 *
 * Persistence keeps the session across reloads. Only the tokens and the user are
 * stored, never a password, and `partialize` makes that explicit.
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      // Starts as `loading` so the router can wait for the persisted state to be
      // read before deciding whether to render a protected route.
      status: 'loading',
      hydrated: false,

      setSession: ({ user, accessToken, refreshToken }) =>
        set({ user, accessToken, refreshToken, status: 'authenticated', hydrated: true }),

      setTokens: (tokens) =>
        set((state) => ({
          accessToken: tokens.accessToken === undefined ? state.accessToken : tokens.accessToken,
          refreshToken: tokens.refreshToken === undefined ? state.refreshToken : tokens.refreshToken,
          status: state.user === null ? state.status : 'authenticated',
        })),

      clear: () => set({ user: null, accessToken: null, refreshToken: null, status: 'anonymous', hydrated: true }),

      markHydrated: () => set({ hydrated: true }),
    }),
    {
      name: 'campaign-assistant:session',
      // Local storage is synchronous, so rehydration runs before the first
      // render; the flag tells the router when the restored state is trustworthy.
      onRehydrateStorage: () => (state) => state?.markHydrated(),
      // `merge` re-derives `status` from what was restored instead of persisting a
      // stale `loading` value from a previous page load.
      merge: (persisted, current) => {
        const stored = persisted as Partial<AuthState> | undefined
        const user = stored?.user ?? null
        return {
          ...current,
          user,
          accessToken: stored?.accessToken ?? null,
          refreshToken: stored?.refreshToken ?? null,
          status: user === null ? 'anonymous' : 'authenticated',
        }
      },
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
      }),
    },
  ),
)