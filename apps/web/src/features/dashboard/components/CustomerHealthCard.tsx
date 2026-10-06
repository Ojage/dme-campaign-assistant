import { useTranslation } from 'react-i18next'
import { Activity } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { formatNumber } from '@/utils/formatters'
import type { CustomerHealth, CustomerHealthLevel } from '@/features/customers/types/customer.types'
import { ChartEmptyState } from './ChartEmptyState'

const LEVEL_COLORS: Record<CustomerHealthLevel, string> = {
  healthy: 'hsl(var(--success))',
  attention: 'hsl(var(--warning))',
  critical: 'hsl(var(--destructive))',
}

const LEVEL_CLASSES: Record<CustomerHealthLevel, string> = {
  healthy: 'bg-success/15 text-success',
  attention: 'bg-warning/15 text-warning',
  critical: 'bg-destructive/15 text-destructive',
}

interface CustomerHealthCardProps {
  health: CustomerHealth | null
}

/** Composite base health as a ring gauge with the contributing metrics below. */
export function CustomerHealthCard({ health }: CustomerHealthCardProps) {
  const { t } = useTranslation('dashboard')

  if (!health) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('health.title')}</CardTitle>
          <CardDescription>{t('health.description')}</CardDescription>
        </CardHeader>
        <CardContent><ChartEmptyState /></CardContent>
      </Card>
    )
  }

  // Ring geometry: the score maps to a fraction of the full circumference,
  // drawn clockwise from 12 o'clock (stroke-dashoffset on a rotated circle).
  const radius = 52
  const circumference = 2 * Math.PI * radius
  const filled = (health.score / 100) * circumference
  const color = LEVEL_COLORS[health.level]

  const metrics = [
    { label: t('health.activeShare'), value: `${Math.round(health.activeShare)}%`, tone: 'text-foreground' as const },
    { label: t('health.churnedShare'), value: `${Math.round(health.churnedShare)}%`, tone: 'text-destructive' as const },
    { label: t('health.atRisk'), value: formatNumber(health.staleActives), tone: 'text-warning' as const },
    { label: t('health.inactive'), value: formatNumber(health.inactiveCount), tone: 'text-muted-foreground' as const },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          {t('health.title')}
        </CardTitle>
        <CardDescription>{t('health.description')}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-center">
          <div
            className="relative h-40 w-40"
            role="img"
            aria-label={t('health.scoreAria', { score: health.score, level: t(`health.level.${health.level}`) })}
          >
            <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
              <circle cx="60" cy="60" r={radius} fill="none" stroke="hsl(var(--muted))" strokeWidth="12" />
              <circle
                cx="60"
                cy="60"
                r={radius}
                fill="none"
                stroke={color}
                strokeWidth="12"
                strokeLinecap="round"
                strokeDasharray={`${filled} ${circumference - filled}`}
                style={{ transition: 'stroke-dasharray 0.6s ease' }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <p className="text-3xl font-bold tabular-nums text-foreground">{health.score}</p>
              <span className={['mt-1 rounded-full px-2 py-0.5 text-xs font-semibold', LEVEL_CLASSES[health.level]].join(' ')}>
                {t(`health.level.${health.level}`)}
              </span>
            </div>
          </div>
        </div>

        <ul className="mt-5 grid grid-cols-2 gap-2">
          {metrics.map((metric) => (
            <li key={metric.label} className="rounded-lg border border-border bg-muted/30 px-3 py-2">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{metric.label}</p>
              <p className={`mt-0.5 text-lg font-semibold tabular-nums ${metric.tone}`}>{metric.value}</p>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}