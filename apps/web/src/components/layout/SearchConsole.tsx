import { useCallback, useEffect, useMemo, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  CornerDownLeft,
  History,
  LayoutDashboard,
  Megaphone,
  PieChart,
  RotateCcw,
  Search,
  SearchX,
  Sparkles,
  User,
  Users,
} from 'lucide-react'
import { RoutePath } from '@/app/router/RoutePaths'
import { ScrollArea } from '@/components/common/ScrollArea'
import { Button } from '@/components/common/Button'
import { useGlobalSearch } from '@/features/search/hooks/useGlobalSearch'
import { SearchHighlight } from '@/features/search/components/SearchHighlight'
import { fuzzyMatch } from '@/features/search/lib/text'
import { SEARCH_TYPES, type SearchHit, type SearchType } from '@/features/search/types/search.types'
import { cn } from '@/lib/utils'

const RECENT_NAV_KEY = 'campaign-assistant:recent-nav'
const RECENT_QUERIES_KEY = 'campaign-assistant:recent-queries'
const RECENT_CAP = 6

interface NavItem {
  path: RoutePath
  labelKey: string
  icon: typeof LayoutDashboard
}

const NAV_ITEMS: NavItem[] = [
  { path: RoutePath.DASHBOARD, labelKey: 'nav.dashboard', icon: LayoutDashboard },
  { path: RoutePath.CUSTOMERS, labelKey: 'nav.customers', icon: Users },
  { path: RoutePath.SEGMENTS, labelKey: 'nav.segments', icon: PieChart },
  { path: RoutePath.CAMPAIGNS, labelKey: 'nav.campaigns', icon: Megaphone },
]

const TYPE_ICONS: Record<SearchType, typeof User> = {
  customer: User,
  segment: PieChart,
  campaign: Megaphone,
}

const TYPE_PAGE: Record<SearchType, RoutePath> = {
  customer: RoutePath.CUSTOMERS,
  segment: RoutePath.SEGMENTS,
  campaign: RoutePath.CAMPAIGNS,
}

const TYPE_SECTION_KEY: Record<SearchType, string> = {
  customer: 'topbar.sectionCustomers',
  segment: 'topbar.sectionSegments',
  campaign: 'topbar.sectionCampaigns',
}

export const SEARCH_SUGGESTIONS = ['topbar.suggestionHighValue', 'topbar.suggestionDormant', 'topbar.suggestionCameroon', 'topbar.suggestionBlaise']

function readList(key: string): string[] {
  try {
    const raw = window.localStorage.getItem(key)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string').slice(0, RECENT_CAP) : []
  } catch {
    return []
  }
}

function pushList(key: string, value: string): void {
  const next = [value, ...readList(key).filter((item) => item !== value)].slice(0, RECENT_CAP)
  window.localStorage.setItem(key, JSON.stringify(next))
}

/** What an option does, shared by the keyboard cursor and the click handler. */
interface PaletteOption {
  key: string
  onSelect: () => void
}

/**
 * Command-palette search.
 *
 * Type — the palette queries the API (debounced, aborting stale requests) and
 * layers a fast local fuzzy match for the four navigation destinations on top,
 * so the two zones search together. Keyboard, ARIA and the empty/loading/error
 * states all live here, and picking a record deep-links to its section page.
 */
export function SearchConsole({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation('common')
  const navigate = useNavigate()
  const { query, setQuery, activeQuery, status, response, previousResponse, error, retry, clear } = useGlobalSearch()
  const [facet, setFacet] = useState<SearchType | 'all'>('all')
  const [active, setActive] = useState(0)
  const [recentQueries, setRecentQueries] = useState<string[]>(() => readList(RECENT_QUERIES_KEY))
  const [recentNav, setRecentNav] = useState<string[]>(() => readList(RECENT_NAV_KEY))

  const hasQuery = query.trim().length > 0

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // The visible data is the latched previous response while a newer query loads,
  // so results never flash away between keystrokes.
  const visibleResponse = status === 'loading' && previousResponse ? previousResponse : response
  const searching = status === 'loading'

  const openRecord = useCallback(
    (hit: SearchHit, queried: string) => {
      pushList(RECENT_NAV_KEY, TYPE_PAGE[hit.type])
      if (queried) pushList(RECENT_QUERIES_KEY, queried)
      setRecentQueries(readList(RECENT_QUERIES_KEY))
      navigate({ pathname: TYPE_PAGE[hit.type], search: `?focus=${hit.id}` })
      onClose()
    },
    [navigate, onClose],
  )

  const openNav = useCallback(
    (item: NavItem) => {
      pushList(RECENT_NAV_KEY, item.path)
      setRecentNav(readList(RECENT_NAV_KEY))
      navigate(item.path)
      onClose()
    },
    [navigate, onClose],
  )

  const navMatches = useMemo(() => {
    if (!hasQuery) return []
    return NAV_ITEMS.map((item) => ({ item, match: fuzzyMatch(query, t(item.labelKey)) }))
      .filter((entry): entry is { item: NavItem; match: NonNullable<ReturnType<typeof fuzzyMatch>> } => entry.match !== null)
      .sort((a, b) => b.match.score - a.match.score)
  }, [query, hasQuery, t])

  const hits = useMemo(() => {
    const source = visibleResponse?.results ?? []
    if (facet === 'all') return source
    return source.filter((hit) => hit.type === facet)
  }, [visibleResponse, facet])

  const counts = useMemo(() => {
    const byType = new Map<SearchType, number>()
    for (const type of SEARCH_TYPES) byType.set(type, 0)
    for (const hit of visibleResponse?.results ?? []) byType.set(hit.type, (byType.get(hit.type) ?? 0) + 1)
    return byType
  }, [visibleResponse])

  const showNavSection = navMatches.length > 0
  const anyData = hits.length > 0
  const searchingFresh = searching && !visibleResponse?.results.length

  // The flat keyboard order: navigation matches first, then data by type.
  const options = useMemo(() => {
    const flat: PaletteOption[] = []
    for (const { item } of navMatches) flat.push({ key: `nav:${item.path}`, onSelect: () => openNav(item) })
    for (const hit of hits) flat.push({ key: `hit:${hit.type}:${hit.id}`, onSelect: () => openRecord(hit, activeQuery) })
    return flat
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navMatches, hits, activeQuery, openNav, openRecord])

  useEffect(() => setActive(0), [query, facet])
  useEffect(() => {
    const el = document.getElementById(`search-option-${active}`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [active])

  const onInputKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActive((n) => Math.min(n + 1, options.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActive((n) => Math.max(n - 1, 0))
    } else if (event.key === 'Home') {
      event.preventDefault()
      setActive(0)
    } else if (event.key === 'End') {
      event.preventDefault()
      setActive(options.length - 1)
    } else if (event.key === 'Enter') {
      event.preventDefault()
      options[active]?.onSelect()
    } else if (event.key === 'Escape') {
      if (query.length > 0) {
        event.preventDefault()
        clear()
      }
    }
  }

  return (
    <motion.div
      className="absolute inset-0 z-50"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
    >
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <motion.div
        initial={{ opacity: 0, y: -14, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -10, scale: 0.98 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="absolute left-1/2 top-[8%] w-[min(680px,92%)] -translate-x-1/2"
      >
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-retool-lg">
          {/* Input row */}
          <div className="relative flex items-center gap-3 px-5 py-4">
            <Search className="h-5 w-5 shrink-0 text-muted-foreground" />
            <input
              autoFocus
              role="combobox"
              aria-expanded
              aria-controls="search-listbox"
              aria-activedescendant={options.length > 0 ? `search-option-${active}` : undefined}
              aria-busy={searching}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={onInputKeyDown}
              placeholder={t('topbar.searchPlaceholder')}
              className="h-6 min-w-0 flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground"
            />
            <AnimatePresence mode="wait">
              {searching ? (
                <motion.span
                  key="spinner"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-primary/20 border-t-primary"
                />
              ) : null}
            </AnimatePresence>
            <kbd className="hidden rounded-md border border-border bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground sm:inline-block">
              {t('topbar.esc')}
            </kbd>

            {/* Facet chips */}
            {hasQuery ? (
              <div className="absolute left-12 right-12 top-full z-10 -mt-1 flex items-center gap-1.5 overflow-x-auto pb-0 pt-2">
                <FacetChip
                  active={facet === 'all'}
                  label={t('topbar.search')}
                  count={visibleResponse?.total}
                  onClick={() => setFacet('all')}
                />
                {SEARCH_TYPES.map((type) => (
                  <FacetChip
                    key={type}
                    active={facet === type}
                    label={t(TYPE_SECTION_KEY[type])}
                    count={counts.get(type)}
                    onClick={() => setFacet(type)}
                  />
                ))}
              </div>
            ) : null}
          </div>

          <ScrollArea
            className="max-h-[min(420px,52vh)] shrink [--scroll-edge-color:hsl(var(--card))]"
            contentClassName="p-2"
            label={t('topbar.search')}
          >
            <div id="search-listbox" role="listbox" className="mt-2 flex flex-col gap-1" aria-label={t('topbar.search')}>
              {!hasQuery ? (
                <IdleState
                  recentQueries={recentQueries}
                  recentNav={recentNav}
                  onQuery={(value) => setQuery(value)}
                  openNav={openNav}
                  clearRecent={() => {
                    localStorage.removeItem(RECENT_QUERIES_KEY)
                    setRecentQueries([])
                  }}
                />
              ) : searchingFresh ? (
                <SkeletonState />
              ) : status === 'error' ? (
                <ErrorState message={error} onRetry={retry} query={query} onQuery={(value) => setQuery(value)} />
              ) : !showNavSection && !anyData ? (
                <EmptyState query={query} onQuery={(value) => setQuery(value)} />
              ) : (
                <>
                  {showNavSection ? <SectionHeading label={t('topbar.navigation')} /> : null}
                  {navMatches.map(({ item }) => {
                    const label = t(item.labelKey)
                    const Icon = item.icon
                    const optionIndex = options.findIndex((option) => option.key === `nav:${item.path}`)
                    return (
                      <OptionRow
                        key={`nav:${item.path}`}
                        index={optionIndex}
                        activeIndex={active}
                        onClick={() => openNav(item)}
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                          <Icon className="h-4 w-4 text-muted-foreground" />
                        </span>
                        <span className="flex-1 truncate text-sm font-medium text-foreground">
                          <SearchHighlight text={label} query={query} />
                        </span>
                        <CornerDownLeft className="h-3.5 w-3.5 text-muted-foreground/50" />
                      </OptionRow>
                    )
                  })}

                  {SEARCH_TYPES.map((type) => {
                    const typeHits = hits.filter((hit) => hit.type === type)
                    if (typeHits.length === 0) return null
                    return (
                      <div key={type} className="flex flex-col gap-1">
                        <SectionHeading
                          label={t(TYPE_SECTION_KEY[type])}
                          count={typeHits.length}
                          viewAll={
                            facet === type ? null : (
                              <button
                                type="button"
                                onClick={() => {
                                  pushList(RECENT_NAV_KEY, TYPE_PAGE[type])
                                  setRecentNav(readList(RECENT_NAV_KEY))
                                  navigate(TYPE_PAGE[type])
                                  onClose()
                                }}
                                className="text-[11px] font-medium text-primary hover:underline"
                              >
                                {t('topbar.viewAll')}
                              </button>
                            )
                          }
                        />
                        {typeHits.map((hit) => {
                          const optionIndex = options.findIndex((option) => option.key === `hit:${hit.type}:${hit.id}`)
                          return <HitRow key={`hit:${hit.type}:${hit.id}`} hit={hit} query={activeQuery} index={optionIndex} activeIndex={active} onSelect={openRecord} />
                        })}
                      </div>
                    )
                  })}
                </>
              )}
            </div>
          </ScrollArea>

          {/* Footer */}
          <div className="flex items-center justify-between gap-3 border-t border-border px-5 py-2.5 text-[11px] text-muted-foreground">
            <span className="hidden items-center gap-3 sm:flex">
              <span className="inline-flex gap-1.5">
                {t('topbar.hintUpDown')} · {t('topbar.hintEnter')} · {t('topbar.hintEsc')}
              </span>
            </span>
            <span className="hidden items-center gap-3 sm:flex" aria-hidden="true">
              <Sparkles className="h-3 w-3" />
              {t('topbar.searchPlaceholder')}
            </span>
            <span className="ml-auto pr-1 tabular-nums">
              {visibleResponse
                ? visibleResponse.total === 1
                  ? t('topbar.resultOne', { took: visibleResponse.tookMs })
                  : t('topbar.results', { n: visibleResponse.total, took: visibleResponse.tookMs })
                : searching
                  ? t('topbar.searching')
                  : ''}
            </span>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

function FacetChip({ active, label, count, onClick }: { active: boolean; label: string; count?: number; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors',
        active ? 'border-primary/50 bg-primary/10 text-primary' : 'border-border bg-card text-muted-foreground hover:bg-muted/60',
      )}
    >
      {label}
      {typeof count === 'number' && count > 0 ? <span className="rounded-full bg-muted px-1.5 text-[10px] tabular-nums">{count}</span> : null}
    </button>
  )
}

function SectionHeading({ label, count, viewAll }: { label: string; count?: number; viewAll?: ReactNode }) {
  return (
    <div className="flex items-center justify-between px-3 pb-1 pt-2">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
        {typeof count === 'number' ? <span className="text-[10px] font-semibold tabular-nums">{count}</span> : null}
      </p>
      {viewAll}
    </div>
  )
}

function OptionRow({ index, activeIndex, onClick, children }: { index: number; activeIndex: number; onClick: () => void; children: ReactNode }) {
  return (
    <button
      id={`search-option-${index}`}
      type="button"
      role="option"
      aria-selected={index === activeIndex}
      onClick={onClick}
      onMouseEnter={() => undefined}
      className={cn(
        'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors',
        index === activeIndex ? 'bg-primary/10 ring-1 ring-primary/20' : 'hover:bg-muted/60',
      )}
    >
      {children}
    </button>
  )
}

function RelevanceDots({ score }: { score: number }) {
  const filled = Math.max(1, Math.min(5, Math.round((score / 1.8) * 5)))
  return (
    <span className="hidden shrink-0 items-center gap-0.5 sm:flex" aria-label={`relevance ${filled}/5`}>
      {Array.from({ length: 5 }).map((_, index) => (
        <span key={index} className={cn('h-1 w-1 rounded-full', index < filled ? 'bg-primary/60' : 'bg-muted')} />
      ))}
    </span>
  )
}

function HitRow({ hit, query, index, activeIndex, onSelect }: { hit: SearchHit; query: string; index: number; activeIndex: number; onSelect: (hit: SearchHit, query: string) => void }) {
  const { t } = useTranslation('common')
  const Icon = TYPE_ICONS[hit.type]
  const badgeClass =
    hit.meta === 'active' ? 'bg-success/10 text-success' : hit.meta === 'inactive' ? 'bg-warning/10 text-warning' : hit.meta === 'churned' ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground'

  return (
    <OptionRow index={index} activeIndex={activeIndex} onClick={() => onSelect(hit, query)}>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-sm font-medium text-foreground">
            <SearchHighlight text={hit.title} query={query} />
          </span>
          {hit.meta ? <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold', badgeClass)}>{t(`status.${hit.meta}`, hit.meta)}</span> : null}
        </span>
        {hit.subtitle ? (
          <span className="block truncate text-xs text-muted-foreground">
            <SearchHighlight text={hit.subtitle} query={query} />
          </span>
        ) : null}
      </span>
      <RelevanceDots score={hit.score} />
      <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
    </OptionRow>
  )
}

function SkeletonState() {
  return (
    <div className="flex flex-col gap-1.5 px-1.5 py-1" aria-hidden="true">
      {Array.from({ length: 4 }).map((_, row) => (
        <div key={row} className="flex items-center gap-3 rounded-xl px-3 py-2.5">
          <span className="h-8 w-8 shrink-0 animate-pulse rounded-lg bg-muted" />
          <span className="flex flex-1 flex-col gap-1.5">
            <span className="h-3.5 w-2/3 animate-pulse rounded bg-muted" />
            <span className="h-3 w-1/2 animate-pulse rounded bg-muted/70" />
          </span>
        </div>
      ))}
    </div>
  )
}

function EmptyState({ query, onQuery }: { query: string; onQuery: (value: string) => void }) {
  const { t } = useTranslation('common')
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
      <SearchX className="h-8 w-8 text-muted-foreground/50" />
      <p className="text-sm font-medium text-foreground">{t('topbar.noResultsFor', { query })}</p>
      <Suggestions onQuery={onQuery} />
    </div>
  )
}

function ErrorState({ message, onRetry, query, onQuery }: { message: string | null; onRetry: () => void; query: string; onQuery: (value: string) => void }) {
  const { t } = useTranslation('common')
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
        <SearchX className="h-5 w-5 text-destructive" />
      </span>
      <p className="text-sm font-medium text-foreground">{message ?? t('topbar.searchError')}</p>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" leftIcon={<RotateCcw className="h-4 w-4" />} onClick={onRetry}>
          {t('actions.retry')}
        </Button>
      </div>
      <Suggestions onQuery={onQuery} query={query} />
    </div>
  )
}

function Suggestions({ onQuery, query }: { onQuery: (value: string) => void; query?: string }) {
  const { t } = useTranslation('common')
  return (
    <div className="flex flex-wrap items-center justify-center gap-1.5">
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{t('topbar.suggestions')}:</span>
      {SEARCH_SUGGESTIONS.filter((key) => t(key).toLowerCase() !== query?.trim().toLowerCase()).map((key) => (
        <button
          key={key}
          type="button"
          onClick={() => onQuery(t(key))}
          className="rounded-full border border-border bg-muted/40 px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          {t(key)}
        </button>
      ))}
    </div>
  )
}

function IdleState({
  recentQueries,
  recentNav,
  onQuery,
  openNav,
  clearRecent,
}: {
  recentQueries: string[]
  recentNav: string[]
  onQuery: (value: string) => void
  openNav: (item: NavItem) => void
  clearRecent: () => void
}) {
  const { t } = useTranslation('common')
  const navItems = recentNav
    .map((path) => NAV_ITEMS.find((item) => item.path === path))
    .filter((item): item is NavItem => Boolean(item))

  return (
    <div className="flex flex-col gap-1">
      {recentQueries.length > 0 ? (
        <>
          <SectionHeading label={t('topbar.recentSearches')} viewAll={<button type="button" onClick={clearRecent} className="text-[11px] font-medium text-muted-foreground hover:text-foreground">{t('topbar.clearRecent')}</button>} />
          {recentQueries.map((entry) => (
            <button
              key={entry}
              type="button"
              onClick={() => onQuery(entry)}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-muted/60"
            >
              <History className="h-4 w-4 shrink-0 text-muted-foreground/60" />
              <span className="flex-1 truncate text-sm text-foreground">{entry}</span>
              <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
            </button>
          ))}
        </>
      ) : null}

      {navItems.length > 0 ? (
        <>
          <SectionHeading label={t('topbar.recent')} />
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.path}
                type="button"
                onClick={() => openNav(item)}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-muted/60"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </span>
                <span className="flex-1 truncate text-sm font-medium text-foreground">{t(item.labelKey)}</span>
                <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
              </button>
            )
          })}
        </>
      ) : null}

      {recentQueries.length === 0 && navItems.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
          <Sparkles className="h-6 w-6 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">{t('topbar.searchPlaceholder')}</p>
        </div>
      ) : null}
      <div className="px-3 pt-2 pb-1">
        <Suggestions onQuery={onQuery} />
      </div>
    </div>
  )
}