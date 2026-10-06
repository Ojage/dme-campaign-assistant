import { useTranslation } from 'react-i18next'
import { Users, UserCheck, Banknote, Coins } from 'lucide-react'
import type { CustomerKPIs } from '@/features/customers/types/customer.types'
import { StatCard } from '@/components/common/StatCard'
import { formatNumber, formatXaf, formatXafCompact } from '@/utils/formatters'

interface KPISectionProps {
  kpis: CustomerKPIs | null
  isLoading: boolean
}

function KpiSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-[110px] animate-pulse rounded-xl border border-border bg-card" />
      ))}
    </div>
  )
}

export function KPISection({ kpis, isLoading }: KPISectionProps) {
  const { t } = useTranslation('dashboard')

  if (isLoading || !kpis) return <KpiSkeleton />

  const activeShare = kpis.totalCustomers > 0 ? Math.round((kpis.activeCustomers / kpis.totalCustomers) * 100) : 0
  const churnedHint =
    kpis.statusCounts.churned > 0 ? ` · ${t('kpis.churned', { n: formatNumber(kpis.statusCounts.churned) })}` : ''

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        icon={Users}
        label={t('kpis.totalCustomers')}
        value={formatNumber(kpis.totalCustomers)}
        hint={t('kpis.allStatuses')}
      />
      <StatCard
        icon={UserCheck}
        label={t('kpis.activeCustomers')}
        value={formatNumber(kpis.activeCustomers)}
        hint={`${t('kpis.ofBase', { n: activeShare })}${churnedHint}`}
        tone="accent"
      />
      <StatCard
        icon={Banknote}
        label={t('kpis.totalValue')}
        value={formatXafCompact(kpis.totalTransactionValue)}
        hint={formatXaf(kpis.totalTransactionValue)}
      />
      <StatCard
        icon={Coins}
        label={t('kpis.avgValue')}
        value={formatXafCompact(kpis.averageCustomerValue)}
        hint={t('kpis.lifetimeSpend')}
      />
    </div>
  )
}
