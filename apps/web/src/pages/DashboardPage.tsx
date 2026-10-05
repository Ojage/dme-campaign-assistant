import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Users, UserCheck, Banknote, Coins, Megaphone } from 'lucide-react'
import { PageWrapper } from '@/components/common/PageWrapper'
import { PageHeader } from '@/components/layout/PageHeader'
import { StatCard } from '@/components/common/StatCard'
import { ErrorMessage } from '@/components/common/ErrorMessage'
import { Button } from '@/components/common/Button'
import { KPISection } from '@/features/customers/components/KPISection'
import {
  RevenueTrendCard,
  SpendByCountryCard,
  StatusBreakdownCard,
} from '@/features/dashboard/components/DashboardCharts'
import { useDashboard } from '@/features/dashboard/hooks/useDashboard'
import { formatNumber, formatXafCompact } from '@/utils/formatters'
import { RoutePath } from '@/app/router/RoutePaths'

export default function DashboardPage() {
  const { t } = useTranslation('dashboard')
  const navigate = useNavigate()
  const { kpis, spendByCountry, revenueTrend, isLoading, error, reload } = useDashboard()

  // Inactive covers both inactive and churned in the KPI aggregate; churned
  // shows as zero until the api layer exposes a per-status breakdown.
  const statusData = kpis
    ? [
        { name: t('charts.active'), value: kpis.activeCustomers },
        { name: t('charts.inactive'), value: kpis.totalCustomers - kpis.activeCustomers },
      ]
    : []

  return (
    <PageWrapper>
      <div className="flex flex-col gap-6 p-8">
        <PageHeader
          title={t('title')}
          description={t('description')}
          actions={
            <Button
              leftIcon={<Megaphone className="h-4 w-4" />}
              onClick={() => navigate(RoutePath.CAMPAIGNS)}
            >
              {t('newCampaign')}
            </Button>
          }
        />

        {error ? (
          <ErrorMessage message={error} onRetry={reload} />
        ) : (
          <>
            <KPISection kpis={kpis} isLoading={isLoading} />

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
              <div className="xl:col-span-2">
                {isLoading ? (
                  <div className="h-[340px] animate-pulse rounded-xl border border-border bg-card" />
                ) : (
                  <RevenueTrendCard data={revenueTrend} />
                )}
              </div>
              {isLoading ? (
                <div className="h-[340px] animate-pulse rounded-xl border border-border bg-card" />
              ) : (
                <StatusBreakdownCard data={statusData} />
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
              <div className="xl:col-span-2">
                {isLoading ? (
                  <div className="h-[340px] animate-pulse rounded-xl border border-border bg-card" />
                ) : (
                  <SpendByCountryCard data={spendByCountry} />
                )}
              </div>
              <div className="grid grid-cols-1 gap-4">
                <StatCard
                  icon={Users}
                  label={t('stats.customerBase')}
                  value={kpis ? formatNumber(kpis.totalCustomers) : '—'}
                  hint={t('stats.acrossMarkets')}
                />
                <StatCard
                  icon={UserCheck}
                  label={t('stats.activeShare')}
                  value={kpis ? `${Math.round((kpis.activeCustomers / kpis.totalCustomers) * 100)}%` : '—'}
                  hint={t('stats.activeVsTotal')}
                  tone="accent"
                />
                <StatCard
                  icon={Banknote}
                  label={t('stats.lifetimeValue')}
                  value={kpis ? formatXafCompact(kpis.totalTransactionValue) : '—'}
                  hint={t('stats.avgPerCustomer', {
                    value: kpis ? formatXafCompact(kpis.averageCustomerValue) : '—',
                  })}
                />
                <StatCard icon={Coins} label={t('stats.segmentsReady')} value="3" hint={t('stats.savedAudiences')} />
              </div>
            </div>
          </>
        )}
      </div>
    </PageWrapper>
  )
}
