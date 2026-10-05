import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { LANGUAGE_STORAGE_KEY, type AppLanguage } from '@/i18n/index'

/** Language switcher logic — persists the choice and updates i18n live. */
export function useAppLanguage() {
  const { i18n } = useTranslation()
  const language: AppLanguage = i18n.language.startsWith('fr') ? 'fr' : 'en'

  const setLanguage = useCallback((next: AppLanguage) => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, next)
    void i18n.changeLanguage(next)
  }, [i18n])

  return { language, setLanguage }
}
