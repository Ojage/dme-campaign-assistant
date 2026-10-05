import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import enCommon from '@/i18n/locales/en/common'
import enDashboard from '@/i18n/locales/en/dashboard'
import enCustomers from '@/i18n/locales/en/customers'
import enSegments from '@/i18n/locales/en/segments'
import enCampaigns from '@/i18n/locales/en/campaigns'
import enAuth from '@/i18n/locales/en/auth'
import frCommon from '@/i18n/locales/fr/common'
import frDashboard from '@/i18n/locales/fr/dashboard'
import frCustomers from '@/i18n/locales/fr/customers'
import frSegments from '@/i18n/locales/fr/segments'
import frCampaigns from '@/i18n/locales/fr/campaigns'
import frAuth from '@/i18n/locales/fr/auth'

export type AppLanguage = 'en' | 'fr'

export const LANGUAGE_STORAGE_KEY = 'campaign-assistant:language'

/**
 * Locale resources are grouped by feature — each page/feature owns its own
 * namespace (`common`, `auth`, `dashboard`, `customers`, `segments`, `campaigns`) so
 * new features add one file per language instead of editing shared files.
 */
const resources = {
  en: {
    common: enCommon,
    auth: enAuth,
    dashboard: enDashboard,
    customers: enCustomers,
    segments: enSegments,
    campaigns: enCampaigns,
  },
  fr: {
    common: frCommon,
    auth: frAuth,
    dashboard: frDashboard,
    customers: frCustomers,
    segments: frSegments,
    campaigns: frCampaigns,
  },
}

function resolveInitialLanguage(): AppLanguage {
  const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY)
  if (stored === 'en' || stored === 'fr') return stored
  return navigator.language.toLowerCase().startsWith('fr') ? 'fr' : 'en'
}

if (!i18n.isInitialized) {
  void i18n.use(initReactI18next).init({
    resources,
    lng: resolveInitialLanguage(),
    fallbackLng: 'en',
    defaultNS: 'common',
    interpolation: { escapeValue: false },
    returnNull: false,
  })
}

export default i18n
