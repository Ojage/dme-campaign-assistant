import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Megaphone, PieChart, Target, Users } from 'lucide-react'
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
import { CustomerHealthCard } from '@/features/dashboard/components/CustomerHealthCard'
import { TopCustomersCard } from '@/features/dashboard/components/TopCustomersCard'
import { useDashboard } from '@/features/dashboard/hooks/useDashboard'
import { formatNumber } from '@/utils/formatters'
import { RoutePath } from '@/app/router/RoutePaths'

function ChartSkeleton() {
  return <div className="h-[340px] animate-pulse rounded-xl border border-border bg-card" />
}

const EMPTY_STATUS_COUNTS = { active: 0, inactive: 0, churned: 0 }

/**
 * One grid slot of the dashboard heart. Each card drives itself: it skeletons
 * while its own query loads, shows a retryable error when that query fails, and
 * otherwise renders the card — so a failing aggregate never hides the rest.
 */
function CardFrame({
  loading,
  error,
  onRetry,
  children,
}: {
  loading: boolean
  error: string | null
  onRetry: () => void
  children: ReactNode
}) {
  if (loading) return <ChartSkeleton />
  if (error !== null) {
    return (
      <div className="h-full min-h-[220px] rounded-xl border border-border bg-card">
        <ErrorMessage message={error} onRetry={onRetry} />
      </div>
    )
  }
  return <>{children}</>
}

export default function DashboardPage() {
  const { t } = useTranslation('dashboard')
  const navigate = useNavigate()
  const [months, setMonths] = useState(6)
  const { kpis, spendByCountry, revenueTrend, health, topCustomers, topTotalValue, segmentsSummary, reload } =
    useDashboard(months)

  return (
    <PageWrapper>
      <div className="flex flex-col gap-4 p-4 sm:gap-6 sm:p-6 xl:p-8">
        <PageHeader
          title={t('title')}
          description={t('description')}
          actions={
            <Button
              leftIcon={<Megaphone className="h-4 w-4" />}
              onClick={() => navigate(RoutePath.CAMPAIGNS)}
              className="w-full sm:w-auto"
            >
              {t('newCampaign')}
            </Button>
          }
        />

        <CardFrame loading={kpis.isLoading} error={kpis.error} onRetry={reload}>
          <KPISection kpis={kpis.data} isLoading={kpis.isLoading} />
        </CardFrame>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <div className="xl:col-span-2">
            <CardFrame loading={revenueTrend.isLoading} error={revenueTrend.error} onRetry={reload}>
              <RevenueTrendCard data={revenueTrend.data} months={months} onMonthsChange={setMonths} />
            </CardFrame>
          </div>
          <div>
            <CardFrame loading={kpis.isLoading} error={kpis.error} onRetry={reload}>
              <StatusBreakdownCard data={kpis.data?.statusCounts ?? EMPTY_STATUS_COUNTS} />
            </CardFrame>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <CardFrame loading={spendByCountry.isLoading} error={spendByCountry.error} onRetry={reload}>
            <SpendByCountryCard data={spendByCountry.data} />
          </CardFrame>
          <CardFrame loading={health.isLoading} error={health.error} onRetry={reload}>
            <CustomerHealthCard health={health.data} />
          </CardFrame>
          <CardFrame loading={topCustomers.isLoading} error={topCustomers.error} onRetry={reload}>
            <TopCustomersCard items={topCustomers.data} totalValue={topTotalValue} />
          </CardFrame>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <CardFrame loading={segmentsSummary.isLoading} error={segmentsSummary.error} onRetry={reload}>
            <StatCard
              icon={PieChart}
              label={t('stats.segmentsReady')}
              value={segmentsSummary.data ? formatNumber(segmentsSummary.data.count) : '—'}
              hint={t('stats.savedAudiences')}
            />
          </CardFrame>
          <CardFrame loading={segmentsSummary.isLoading} error={segmentsSummary.error} onRetry={reload}>
            <StatCard
              icon={Users}
              label={t('stats.totalReach')}
              value={segmentsSummary.data ? formatNumber(segmentsSummary.data.totalAudience) : '—'}
              hint={t('stats.reachDescription')}
              tone="accent"
            />
          </CardFrame>
          <CardFrame loading={segmentsSummary.isLoading} error={segmentsSummary.error} onRetry={reload}>
            <StatCard
              icon={Target}
              label={t('stats.avgAudience')}
              value={segmentsSummary.data ? formatNumber(Math.round(segmentsSummary.data.averageAudience)) : '—'}
              hint={t('stats.avgAudienceDescription')}
            />
          </CardFrame>
        </div>
      </div>
    </PageWrapper>
  )
}