import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { formatNumber, formatXaf } from '@/utils/formatters'
import type { ActivityTrendPoint, CustomerStatus } from '@/features/customers/types/customer.types'
import { ChartEmptyState } from './ChartEmptyState'

const AXIS_STYLE = { fontSize: 12, fill: 'hsl(var(--muted-foreground))' } as const

/**
 * Compact axis labels that adapt to the value range. Recharts picks "nice" ticks
 * for any domain, so the label must not assume millions — otherwise an unrealised
 * store shows "0.0M" for every tick.
 */
function formatAxisTick(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  if (abs >= 1_000) return `${Math.round(value / 1_000)}K`
  return formatNumber(Math.round(value))
}

const TOOLTIP_STYLE = {
  backgroundColor: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: 8,
  fontSize: 12,
  color: 'hsl(var(--foreground))',
} as const

/** '2026-03' → a short month label in the UI language. */
function monthLabel(raw: string, language: string): string {
  const [year, month] = raw.split('-')
  return new Date(Number(year), Number(month ?? 1) - 1, 1).toLocaleDateString(language, { month: 'short' })
}

interface RevenueTrendCardProps {
  data: ActivityTrendPoint[]
  months: number
  onMonthsChange: (months: number) => void
}

export function RevenueTrendCard({ data, months, onMonthsChange }: RevenueTrendCardProps) {
  const { t, i18n } = useTranslation('dashboard')

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle>{t('charts.revenueTrend')}</CardTitle>
          <CardDescription>{t('charts.revenueTrendDesc', { months })}</CardDescription>
        </div>
        <div className="flex rounded-lg border border-border p-0.5" role="group" aria-label={t('charts.trendRangeAria')}>
          {[6, 12].map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={months === option}
              onClick={() => onMonthsChange(option)}
              className={cn(
                'rounded-md px-3 py-1 text-xs font-medium transition-colors',
                months === option ? 'bg-accent/15 text-accent' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {t('charts.months', { n: option })}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <ChartEmptyState />
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
              <defs>
                <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="hsl(var(--chart-1))" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis
                dataKey="month"
                tick={AXIS_STYLE}
                axisLine={false}
                tickLine={false}
                tickFormatter={(raw: string) => monthLabel(raw, i18n.language)}
              />
              <YAxis
                tick={AXIS_STYLE}
                axisLine={false}
                tickLine={false}
                tickFormatter={formatAxisTick}
              />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                content={({ active, payload, label }) => {
                  if (!active || !payload?.[0]) return null
                  const point = payload[0].payload as ActivityTrendPoint
                  return (
                    <div style={TOOLTIP_STYLE} className="rounded-lg px-3 py-2">
                      <p className="mb-1.5 font-semibold text-foreground">{monthLabel(String(label), i18n.language)}</p>
                      <p className="tabular-nums">{t('charts.revenue')}: {formatXaf(point.value)}</p>
                      <p className="tabular-nums text-muted-foreground">{t('charts.customers')}: {formatNumber(point.customers)}</p>
                      <p className="tabular-nums text-muted-foreground">{t('charts.churned')}: {formatNumber(point.churned)}</p>
                    </div>
                  )
                }}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="hsl(var(--chart-1))"
                strokeWidth={2}
                fill="url(#revenueFill)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}

export function SpendByCountryCard({ data }: { data: Array<{ country: string; spend: number }> }) {
  const { t } = useTranslation('dashboard')

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('charts.spendByCountry')}</CardTitle>
        <CardDescription>{t('charts.spendByCountryDesc')}</CardDescription>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <ChartEmptyState />
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
              <XAxis
                type="number"
                tick={AXIS_STYLE}
                axisLine={false}
                tickLine={false}
                tickFormatter={formatAxisTick}
              />
              <YAxis type="category" dataKey="country" tick={AXIS_STYLE} axisLine={false} tickLine={false} width={100} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value) => [formatXaf(Number(value)), t('charts.spend')]} />
              <Bar dataKey="spend" radius={[0, 6, 6, 0]}>
                {data.map((_, index) => (
                  <Cell key={index} fill={index === 0 ? 'hsl(var(--chart-2))' : 'hsl(var(--chart-5))'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}

/** Semantic status colours — the same tokens the customer badges use. */
const STATUS_COLORS: Record<CustomerStatus | 'total', string> = {
  active: 'hsl(var(--success))',
  inactive: 'hsl(var(--warning))',
  churned: 'hsl(var(--destructive))',
  total: 'hsl(var(--chart-1))',
}

interface StatusBreakdownCardProps {
  data: { active: number; inactive: number; churned: number }
}

export function StatusBreakdownCard({ data }: StatusBreakdownCardProps) {
  const { t } = useTranslation('dashboard')
  const [hovered, setHovered] = useState<CustomerStatus | null>(null)

  const total = data.active + data.inactive + data.churned
  if (total === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('charts.status')}</CardTitle>
          <CardDescription>{t('charts.statusDesc')}</CardDescription>
        </CardHeader>
        <CardContent><ChartEmptyState /></CardContent>
      </Card>
    )
  }

  const entries: Array<{ status: CustomerStatus; count: number; share: number }> = (
    [
      ['active', data.active],
      ['inactive', data.inactive],
      ['churned', data.churned],
    ] as const
  ).map(([status, count]) => ({ status, count, share: (count / total) * 100 }))

  const center = hovered ? entries.find((entry) => entry.status === hovered) : null

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('charts.status')}</CardTitle>
        <CardDescription>{t('charts.statusDesc')}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="relative">
          <ResponsiveContainer width="100%" height={200}>
            <PieChart aria-label={t('charts.statusAria', { total: formatNumber(total) })}>
              <Pie
                data={entries}
                cx="50%"
                cy="50%"
                innerRadius={58}
                outerRadius={86}
                paddingAngle={3}
                dataKey="count"
                stroke="hsl(var(--card))"
                onMouseLeave={() => setHovered(null)}
              >
                {entries.map((entry) => (
                  <Cell
                    key={entry.status}
                    fill={STATUS_COLORS[entry.status]}
                    opacity={hovered === null || hovered === entry.status ? 1 : 0.25}
                    onMouseEnter={() => setHovered(entry.status)}
                  />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            {center ? (
              <>
                <p className="text-2xl font-bold tabular-nums text-foreground">{formatNumber(center.count)}</p>
                <p className="text-xs font-medium text-muted-foreground">
                  {Math.round(center.share)}% · {t(`status.${center.status}`)}
                </p>
              </>
            ) : (
              <>
                <p className="text-2xl font-bold tabular-nums text-foreground">{formatNumber(total)}</p>
                <p className="text-xs font-medium text-muted-foreground">{t('charts.total')}</p>
              </>
            )}
          </div>
        </div>

        <ul className="mt-4 flex flex-col gap-1.5" aria-label={t('charts.statusLegendAria')}>
          {entries.map((entry) => (
            <li key={entry.status}>
              <button
                type="button"
                onMouseEnter={() => setHovered(entry.status)}
                onMouseLeave={() => setHovered(null)}
                onFocus={() => setHovered(entry.status)}
                onBlur={() => setHovered(null)}
                className={cn(
                  'flex w-full items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-sm transition-colors',
                  hovered === entry.status ? 'bg-muted/60' : 'hover:bg-muted/40',
                )}
              >
                <span className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: STATUS_COLORS[entry.status] }}
                    aria-hidden="true"
                  />
                  <span className="font-medium text-foreground">{t(`status.${entry.status}`)}</span>
                </span>
                <span className="flex items-center gap-3 tabular-nums">
                  <span className="text-sm text-foreground">{formatNumber(entry.count)}</span>
                  <span className="w-12 text-right text-xs text-muted-foreground">{Math.round(entry.share)}%</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}