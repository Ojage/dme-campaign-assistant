import { useTranslation } from 'react-i18next'
import { Check, Languages, Monitor, Moon, Radar, Sun } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAppTheme, type ThemeMode } from '@/hooks/useAppTheme'
import { useAppLanguage } from '@/hooks/useAppLanguage'
import type { AppLanguage } from '@/i18n'

const THEME_OPTIONS: Array<{ value: ThemeMode; labelKey: string; icon: typeof Sun }> = [
  { value: 'light', labelKey: 'themeLight', icon: Sun },
  { value: 'dark', labelKey: 'themeDark', icon: Moon },
  { value: 'system', labelKey: 'themeSystem', icon: Monitor },
]

const LANGUAGE_OPTIONS: Array<{ value: AppLanguage; labelKey: string }> = [
  { value: 'en', labelKey: 'langEnglish' },
  { value: 'fr', labelKey: 'langFrench' },
]

/**
 * Slim counterpart to the signed-in TopBar: brand mark plus the theme and
 * language pickers, so a visitor can still match their OS before authenticating.
 * Deliberately omits search and the agent — both need a session.
 */
export function AuthTopBar() {
  const { t } = useTranslation('common')
  const { mode, setMode } = useAppTheme()
  const { language, setLanguage } = useAppLanguage()

  return (
    <header className="flex h-12 shrink-0 items-center justify-between px-4 text-[hsl(var(--bar-foreground))]">
      <span className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/20">
          <Radar className="h-4 w-4 text-white" />
        </span>
        <span className="hidden text-sm font-bold text-white/90 sm:inline">
          {t('app.title')} {t('app.titleLine2')}
        </span>
      </span>

      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={t('topbar.language')}
              className="flex h-8 w-8 items-center justify-center rounded-full text-white/85 transition-colors hover:bg-white/15 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <Languages className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuLabel>{t('topbar.language')}</DropdownMenuLabel>
            {LANGUAGE_OPTIONS.map(({ value, labelKey }) => (
              <DropdownMenuItem key={value} onClick={() => setLanguage(value)} className="justify-between">
                <span>{t(`topbar.${labelKey}`)}</span>
                {language === value ? <Check className="h-4 w-4 text-primary" /> : null}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={t('topbar.theme')}
              className="flex h-8 w-8 items-center justify-center rounded-full text-white/85 transition-colors hover:bg-white/15 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              {mode === 'dark' ? <Moon className="h-4 w-4" /> : mode === 'light' ? <Sun className="h-4 w-4" /> : <Monitor className="h-4 w-4" />}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuLabel>{t('topbar.theme')}</DropdownMenuLabel>
            {THEME_OPTIONS.map(({ value, labelKey, icon: Icon }) => (
              <DropdownMenuItem key={value} onClick={() => setMode(value)} className="justify-between">
                <span className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  {t(`topbar.${labelKey}`)}
                </span>
                {mode === value ? <Check className="h-4 w-4 text-primary" /> : null}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="font-normal text-muted-foreground">{t('app.footer')}</DropdownMenuLabel>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
