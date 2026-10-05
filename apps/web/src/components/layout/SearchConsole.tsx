import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { LayoutDashboard, Users, PieChart, Megaphone, Search, CornerDownLeft } from 'lucide-react'
import { RoutePath } from '@/app/router/RoutePaths'
import { ScrollArea } from '@/components/common/ScrollArea'
import { cn } from '@/lib/utils'

const RECENT_KEY = 'campaign-assistant:recent-nav'

interface SearchItem {
  path: RoutePath
  labelKey: string
  icon: typeof LayoutDashboard
}

const ITEMS: SearchItem[] = [
  { path: RoutePath.DASHBOARD, labelKey: 'nav.dashboard', icon: LayoutDashboard },
  { path: RoutePath.CUSTOMERS, labelKey: 'nav.customers', icon: Users },
  { path: RoutePath.SEGMENTS, labelKey: 'nav.segments', icon: PieChart },
  { path: RoutePath.CAMPAIGNS, labelKey: 'nav.campaigns', icon: Megaphone },
]

function readRecent(): string[] {
  try {
    const raw = window.localStorage.getItem(RECENT_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((p): p is string => typeof p === 'string').slice(0, 4) : []
  } catch {
    return []
  }
}

function pushRecent(path: string): string[] {
  const next = [path, ...readRecent().filter((p) => p !== path)].slice(0, 4)
  window.localStorage.setItem(RECENT_KEY, JSON.stringify(next))
  return next
}

/**
 * Command-palette style search. Positioned absolutely within the child panel
 * (its parent), so the red parent bar stays fully visible above the backdrop.
 */
export function SearchConsole({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation('common')
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [recent, setRecent] = useState<string[]>(readRecent)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return ITEMS.filter((item) => t(item.labelKey).toLowerCase().includes(q))
  }, [query, t])

  const recentItems = useMemo(
    () => recent.map((path) => ITEMS.find((item) => item.path === path)).filter((item): item is SearchItem => Boolean(item)),
    [recent],
  )

  const select = (item: SearchItem) => {
    setRecent(pushRecent(item.path))
    navigate(item.path)
    onClose()
  }

  return (
    <motion.div
      className="absolute inset-0 z-40"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
    >
      {/* Backdrop — covers only the panel, not the red bar */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Console card, offset toward the upper portion of the panel */}
      <motion.div
        initial={{ opacity: 0, y: -14, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -10, scale: 0.98 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="absolute left-1/2 top-[12%] w-[min(640px,88%)] -translate-x-1/2"
      >
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-retool-lg">
          <div className="flex items-center gap-3 border-b border-border px-5 py-4">
            <Search className="h-5 w-5 shrink-0 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('topbar.searchPlaceholder')}
              className="h-6 flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground"
            />
            <kbd className="rounded-md border border-border bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
              {t('topbar.esc')}
            </kbd>
          </div>

          <ScrollArea
            className="max-h-80 shrink [--scroll-edge-color:hsl(var(--card))]"
            contentClassName="p-2"
            label={t('topbar.search')}
          >
            {query.trim() === '' ? (
              <>
                <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {t('topbar.recent')}
                </p>
                {recentItems.length === 0 ? (
                  <p className="px-3 py-4 text-sm text-muted-foreground">{t('topbar.noResults')}</p>
                ) : (
                  recentItems.map((item) => (
                    <SearchRow key={item.path} item={item} label={t(item.labelKey)} onSelect={() => select(item)} />
                  ))
                )}
              </>
            ) : results.length === 0 ? (
              <p className="px-3 py-4 text-sm text-muted-foreground">{t('topbar.noResults')}</p>
            ) : (
              results.map((item) => (
                <SearchRow key={item.path} item={item} label={t(item.labelKey)} onSelect={() => select(item)} />
              ))
            )}
          </ScrollArea>
        </div>
      </motion.div>
    </motion.div>
  )
}

function SearchRow({ item, label, onSelect }: { item: SearchItem; label: string; onSelect: () => void }) {
  const Icon = item.icon
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-muted/60"
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </span>
      <span className="flex-1 text-sm font-medium text-foreground">{label}</span>
      <CornerDownLeft className={cn('h-3.5 w-3.5 text-muted-foreground/50')} />
    </button>
  )
}
