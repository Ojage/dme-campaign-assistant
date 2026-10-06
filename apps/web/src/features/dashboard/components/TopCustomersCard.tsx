import { useTranslation } from 'react-i18next'
import { Trophy } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { formatXaf } from '@/utils/formatters'
import type { TopCustomer } from '@/features/customers/types/customer.types'
import { ChartEmptyState } from './ChartEmptyState'

interface TopCustomersCardProps {
  items: TopCustomer[]
  totalValue: number
}

/** Highest-value customers, each row drawing its share of the base's lifetime value. */
export function TopCustomersCard({ items, totalValue }: TopCustomersCardProps) {
  const { t } = useTranslation('dashboard')

  if (items.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            {t('top.title')}
          </CardTitle>
          <CardDescription>{t('top.description')}</CardDescription>
        </CardHeader>
        <CardContent><ChartEmptyState /></CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          {t('top.title')}
        </CardTitle>
        <CardDescription>{t('top.description')}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {items.map((customer, index) => {
          const share = totalValue > 0 ? (customer.totalAmountSpent / totalValue) * 100 : 0
          return (
            <div key={customer.id} className="group flex items-center gap-3">
              <span
                className={cn(
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums',
                  index === 0 ? 'bg-accent/15 text-accent' : 'bg-muted text-muted-foreground',
                )}
                aria-hidden="true"
              >
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="truncate text-sm font-semibold text-foreground">{customer.name}</p>
                  <p className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
                    {formatXaf(customer.totalAmountSpent)}
                  </p>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-xs text-muted-foreground">
                    {customer.country} · {t('top.transactions', { n: customer.totalTransactions })}
                  </p>
                  <span className="w-10 text-right text-xs tabular-nums text-muted-foreground">{Math.round(share)}%</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted" role="presentation">
                  <div
                    className="h-full rounded-full bg-accent transition-all"
                    style={{ width: `${Math.max(share, 2)}%` }}
                  />
                </div>
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}