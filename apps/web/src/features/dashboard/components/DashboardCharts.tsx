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
import { formatXaf } from '@/utils/formatters'

const AXIS_STYLE = { fontSize: 12, fill: 'hsl(var(--muted-foreground))' } as const

const TOOLTIP_STYLE = {
  backgroundColor: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: 8,
  fontSize: 12,
  color: 'hsl(var(--foreground))',
} as const

export function RevenueTrendCard({ data }: { data: Array<{ month: string; revenue: number; activeCustomers: number }> }) {
  const { t } = useTranslation('dashboard')

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('charts.revenueTrend')}</CardTitle>
        <CardDescription>{t('charts.revenueTrendDesc')}</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
            <defs>
              <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity={0.35} />
                <stop offset="100%" stopColor="hsl(var(--chart-1))" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis dataKey="month" tick={AXIS_STYLE} axisLine={false} tickLine={false} />
            <YAxis
              tick={AXIS_STYLE}
              axisLine={false}
              tickLine={false}
              tickFormatter={(value: number) => `${(value / 1_000_000).toFixed(1)}M`}
            />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              formatter={(value) => [formatXaf(Number(value)), t('charts.revenue')]}
            />
            <Area
              type="monotone"
              dataKey="revenue"
              stroke="hsl(var(--chart-1))"
              strokeWidth={2}
              fill="url(#revenueFill)"
            />
          </AreaChart>
        </ResponsiveContainer>
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
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
            <XAxis
              type="number"
              tick={AXIS_STYLE}
              axisLine={false}
              tickLine={false}
              tickFormatter={(value: number) => `${(value / 1_000_000).toFixed(1)}M`}
            />
            <YAxis type="category" dataKey="country" tick={AXIS_STYLE} axisLine={false} tickLine={false} width={100} />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value) => [formatXaf(Number(value)), t('charts.spend')]} />
            <Bar dataKey="spend" radius={[0, 6, 6, 0]}>
              {data.map((_, index) => (
                <Cell
                  key={index}
                  fill={index === 0 ? 'hsl(var(--chart-2))' : 'hsl(var(--chart-5))'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

const STATUS_COLORS = ['hsl(var(--success))', 'hsl(var(--chart-2))', 'hsl(var(--chart-1))'] as const

const statusColor = (index: number): string => STATUS_COLORS[index % STATUS_COLORS.length] ?? STATUS_COLORS[0]!

export function StatusBreakdownCard({ data }: { data: Array<{ name: string; value: number }> }) {
  const { t } = useTranslation('dashboard')

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('charts.status')}</CardTitle>
        <CardDescription>{t('charts.statusDesc')}</CardDescription>
      </CardHeader>
      <CardContent className="flex items-center">
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={85}
              paddingAngle={3}
              dataKey="value"
              stroke="hsl(var(--card))"
            >
              {data.map((_, index) => (
                <Cell key={index} fill={statusColor(index)} />
              ))}
            </Pie>
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value) => [t('charts.count', { n: Number(value) }), '']} />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
