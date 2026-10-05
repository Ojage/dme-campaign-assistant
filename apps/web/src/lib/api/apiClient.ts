import { HttpClient, type TokenStore } from '@dme/contracts/http'
import { useAuthStore } from '@/stores/authStore'

/** Same origin in production; Vite proxies `/api` in development. */
const BASE_URL = import.meta.env.VITE_API_URL ?? '/api'

/**
 * Bridges the shared client to the Zustand store.
 *
 * The client is framework-free, so it is given a `TokenStore` that reads and
 * writes the same store the UI subscribes to. A rotated access token lands in one
 * place and every consumer sees it immediately.
 */
const tokenStore: TokenStore = {
  getAccessToken: () => useAuthStore.getState().accessToken,
  setAccessToken: (token) => useAuthStore.getState().setTokens({ accessToken: token }),
  getRefreshToken: () => useAuthStore.getState().refreshToken,
  setRefreshToken: (token) => useAuthStore.getState().setTokens({ refreshToken: token }),
  clear: () => useAuthStore.getState().clear(),
}

/**
 * One client for the whole app. Retries and response validation live here rather
 * than in hooks, so every feature gets the same behaviour for free.
 */
export const apiClient = new HttpClient({
  baseUrl: BASE_URL,
  tokens: tokenStore,
  // A failed refresh means the session is gone: clear it so the router redirects.
  onSessionLost: () => useAuthStore.getState().clear(),
})