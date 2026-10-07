import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { PersistStorage } from 'zustand/middleware'

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

/** Storage key, shared by rehydration and the cross-tab sync listener. */
export const SESSION_STORAGE_KEY = 'campaign-assistant:session'

/** The slice `partialize` writes, and the only shape this store re-reads. */
interface PersistedSessionSlice {
  user: SessionUser | null
  accessToken: string | null
  refreshToken: string | null
}

/** A complete, usable session — everything the nullable slice must carry. */
interface PersistedSession {
  user: SessionUser
  accessToken: string
  refreshToken: string
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isSessionUser(value: unknown): value is SessionUser {
  return (
    isPlainRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.email === 'string' &&
    typeof value.fullName === 'string' &&
    typeof value.role === 'string'
  )
}

/**
 * Turns whatever came out of localStorage into a well-formed session, or null
 * when the payload is corrupt. A session must carry the user and both tokens;
 * anything partial (write races, hand-edited keys, a different app version) is
 * rejected wholesale rather than half-restored.
 */
function sanitizePersistedSession(value: unknown): PersistedSession | null {
  if (!isPlainRecord(value)) return null
  if (!isSessionUser(value.user)) return null
  const { accessToken, refreshToken } = value
  if (typeof accessToken !== 'string' || typeof refreshToken !== 'string') return null
  return { user: value.user, accessToken, refreshToken }
}

/**
 * Fault-tolerant persist storage. The default JSON storage lets a `JSON.parse`
 * failure escape, and zustand's hydration failure path never calls
 * `markHydrated` — so a single corrupt key would leave the app stuck on the
 * boot screen forever. This storage parses defensively and cleans up, so any
 * corrupt payload resolves to a clean signed-out state instead.
 */
const sessionStorage: PersistStorage<PersistedSessionSlice> = {
  getItem: (name) => {
    const raw = localStorage.getItem(name)
    if (raw === null) return null
    try {
      const parsed: unknown = JSON.parse(raw)
      const state = sanitizePersistedSession(isPlainRecord(parsed) ? parsed.state : undefined)
      if (state !== null) return { state }
      throw new Error('Corrupt session payload')
    } catch {
      localStorage.removeItem(name)
      return null
    }
  },
  setItem: (name, value) => {
    localStorage.setItem(name, JSON.stringify(value))
  },
  removeItem: (name) => {
    localStorage.removeItem(name)
  },
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
      name: SESSION_STORAGE_KEY,
      storage: sessionStorage,
      // Local storage is synchronous, so rehydration runs before the first
      // render; the flag tells the router when the restored state is trustworthy.
      onRehydrateStorage: () => (state) => state?.markHydrated(),
      // `merge` re-derives `status` from what was restored instead of persisting a
      // stale `loading` value from a previous page load.
      merge: (persisted, current) => {
        const stored = persisted as Partial<PersistedSession> | null | undefined
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

// Cross-tab session sync: a sign-in or sign-out in another tab updates this one
// by re-reading the same storage key. `storage` events fire only in other
// tabs, so this never echoes back into the tab that changed the session.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.storageArea !== window.localStorage || event.key !== SESSION_STORAGE_KEY) return
    if (event.oldValue === event.newValue) return
    void useAuthStore.persist.rehydrate()
  })
}