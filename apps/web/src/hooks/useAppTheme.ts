import { useCallback, useEffect, useState } from 'react'

export type ThemeMode = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'campaign-assistant:theme'

function readStoredMode(): ThemeMode {
  const stored = window.localStorage.getItem(STORAGE_KEY)
  return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system'
}

function applyMode(mode: ThemeMode): void {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const isDark = mode === 'dark' || (mode === 'system' && prefersDark)
  document.documentElement.classList.toggle('dark', isDark)
}

/**
 * Theme mode manager. Defaults to following the system; the user can pin
 * light or dark from the top-bar dropdown and the choice persists.
 */
export function useAppTheme() {
  const [mode, setModeState] = useState<ThemeMode>(readStoredMode)

  useEffect(() => {
    applyMode(mode)
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onSystemChange = () => {
      if (mode === 'system') applyMode('system')
    }
    media.addEventListener('change', onSystemChange)
    return () => media.removeEventListener('change', onSystemChange)
  }, [mode])

  const setMode = useCallback((next: ThemeMode) => {
    window.localStorage.setItem(STORAGE_KEY, next)
    setModeState(next)
  }, [])

  return { mode, setMode }
}
