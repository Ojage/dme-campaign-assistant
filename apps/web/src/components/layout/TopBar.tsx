import { useTranslation } from 'react-i18next'
import { Check, Languages, LogOut, Menu, Monitor, Moon, Radar, Search, Sparkles, Sun } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { useAppTheme, type ThemeMode } from '@/hooks/useAppTheme'
import { useAppLanguage } from '@/hooks/useAppLanguage'
import type { AppLanguage } from '@/i18n/index'

const THEME_OPTIONS: Array<{ value: ThemeMode; labelKey: string; icon: typeof Sun }> = [
  { value: 'light', labelKey: 'themeLight', icon: Sun },
  { value: 'dark', labelKey: 'themeDark', icon: Moon },
  { value: 'system', labelKey: 'themeSystem', icon: Monitor },
]

const LANGUAGE_OPTIONS: Array<{ value: AppLanguage; labelKey: string }> = [
  { value: 'en', labelKey: 'langEnglish' },
  { value: 'fr', labelKey: 'langFrench' },
]

interface TopBarProps {
  onOpenSearch: () => void
  onOpenAgent: () => void
  onToggleNav: () => void
}

/**
 * Parent bar: full-width, pinned to the top of the viewport, oxblood red.
 * Icon-only logo on the left (with a menu toggle below lg); Agent pill, search,
 * and avatar cluster on the right.
 */
export function TopBar({ onOpenSearch, onOpenAgent, onToggleNav }: TopBarProps) {
  const { t } = useTranslation('common')
  const { user, signOut } = useAuth()
  const { mode, setMode } = useAppTheme()
  const { language, setLanguage } = useAppLanguage()

  const displayName = user?.fullName || 'Marketing user'
  const initials = displayName
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <header className="flex h-12 shrink-0 items-center justify-between px-4 text-[hsl(var(--bar-foreground))]">
      {/* Left cluster: mobile menu toggle · logo */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onToggleNav}
          aria-label={t('topbar.navMenu')}
          aria-controls="mobile-nav"
          className="flex h-8 w-8 items-center justify-center rounded-full text-white/85 transition-colors hover:bg-white/15 hover:text-white lg:hidden"
        >
          <Menu className="h-4 w-4" />
        </button>
        <span className="hidden h-8 w-8 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/20 sm:flex">
          <Radar className="h-4 w-4 text-white" />
        </span>
      </div>

      {/* Right cluster: Agent pill · search · avatar (right to left) */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onOpenAgent}
          className="flex items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-white/20 sm:px-3.5"
        >
          <Sparkles className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{t('topbar.agent')}</span>
        </button>

        <button
          type="button"
          onClick={onOpenSearch}
          aria-label={t('topbar.search')}
          className="flex h-8 w-8 items-center justify-center rounded-full text-white/85 transition-colors hover:bg-white/15 hover:text-white"
        >
          <Search className="h-4 w-4" />
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Account menu"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-xs font-bold text-[hsl(var(--bar))] ring-2 ring-white/30 transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              {initials || 'M'}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
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

            <DropdownMenuLabel className="flex items-center gap-2">
              <Languages className="h-4 w-4 text-muted-foreground" />
              {t('topbar.language')}
            </DropdownMenuLabel>
            {LANGUAGE_OPTIONS.map(({ value, labelKey }) => (
              <DropdownMenuItem key={value} onClick={() => setLanguage(value)} className="justify-between">
                <span className={value === 'fr' ? 'font-medium' : undefined}>{t(`topbar.${labelKey}`)}</span>
                {language === value ? <Check className="h-4 w-4 text-primary" /> : null}
              </DropdownMenuItem>
            ))}

            <DropdownMenuSeparator />
            <DropdownMenuLabel className="flex flex-col gap-0.5 font-normal">
              <span className="truncate text-sm font-semibold text-foreground">{user?.fullName ?? '…'}</span>
              <span className="truncate text-xs text-muted-foreground">{user?.email ?? t('topbar.team')}</span>
            </DropdownMenuLabel>

            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => void signOut()} className="text-destructive focus:text-destructive">
              <LogOut className="h-4 w-4" />
              {t('topbar.signOut')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
