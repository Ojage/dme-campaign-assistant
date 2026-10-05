/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_NAME?: string
  /** Absolute API base URL; defaults to the proxied `/api` when unset. */
  readonly VITE_API_URL?: string
  readonly VITE_PORT?: string
  readonly VITE_PREVIEW_PORT?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}