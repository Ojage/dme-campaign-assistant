import { NavLink, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Users, PieChart, Megaphone, LayoutDashboard, Radar } from 'lucide-react'
import { RoutePath } from '@/app/router/RoutePaths'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { path: RoutePath.DASHBOARD, labelKey: 'dashboard', icon: LayoutDashboard },
  { path: RoutePath.CUSTOMERS, labelKey: 'customers', icon: Users },
  { path: RoutePath.SEGMENTS, labelKey: 'segments', icon: PieChart },
  { path: RoutePath.CAMPAIGNS, labelKey: 'campaigns', icon: Megaphone },
]

export function Sidebar({ className }: { className?: string }) {
  const { t } = useTranslation('common')
  const location = useLocation()

  return (
    <aside className={cn('flex h-full w-60 shrink-0 flex-col border-r border-[hsl(var(--sidebar-border))] bg-[hsl(var(--sidebar))] text-[hsl(var(--sidebar-foreground))]', className)}>
      <div className="flex items-center gap-2.5 px-5 py-5">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
          <Radar className="h-4 w-4 text-primary-foreground" />
        </span>
        <div className="leading-tight">
          <p className="text-sm font-bold text-[hsl(var(--sidebar-foreground))]">{t('app.title')}</p>
          <p className="text-sm font-bold text-[hsl(var(--sidebar-foreground))] -mt-0.5">{t('app.titleLine2')}</p>
        </div>
      </div>

      <nav className="scrollbar-lift mt-2 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overscroll-contain px-3 py-1">
        {NAV_ITEMS.map(({ path, labelKey, icon: Icon }) => {
          const isActive =
            location.pathname === path || (path !== RoutePath.ROOT && location.pathname.startsWith(path))
          return (
            <NavLink
              key={path}
              to={path}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-[hsl(var(--sidebar-foreground))]/80 hover:bg-[hsl(var(--sidebar-accent))] hover:text-[hsl(var(--sidebar-foreground))]',
              )}
            >
              <Icon className="h-4 w-4" />
              {t(`nav.${labelKey}`)}
            </NavLink>
          )
        })}
      </nav>

      <p className="px-5 py-4 text-[11px] text-[hsl(var(--sidebar-foreground))]/60">{t('app.footer')}</p>
    </aside>
  )
}
