import { useState } from 'react'
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
import { cn } from '@/lib/utils'
import { RoutePath } from '@/app/router/RoutePaths'

function ChartSkeleton() {
  return <div className="h-[340px] animate-pulse rounded-xl border border-border bg-card" />
}

const EMPTY_STATUS_COUNTS = { active: 0, inactive: 0, churned: 0 }

export default function DashboardPage() {
  const { t } = useTranslation('dashboard')
  const navigate = useNavigate()
  const [months, setMonths] = useState(6)
  const {
    kpis,
    spendByCountry,
    revenueTrend,
    health,
    topCustomers,
    topTotalValue,
    segmentsSummary,
    isLoading,
    error,
    reload,
  } = useDashboard(months)

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

        {error ? (
          <ErrorMessage message={error} onRetry={reload} />
        ) : (
          <>
            <KPISection kpis={kpis} isLoading={isLoading} />

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
              <div className="xl:col-span-2">
                {isLoading ? (
                  <ChartSkeleton />
                ) : (
                  <RevenueTrendCard data={revenueTrend} months={months} onMonthsChange={setMonths} />
                )}
              </div>
              <div>
                {isLoading ? (
                  <ChartSkeleton />
                ) : (
                  <StatusBreakdownCard data={kpis?.statusCounts ?? EMPTY_STATUS_COUNTS} />
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
              <div>{isLoading ? <ChartSkeleton /> : <SpendByCountryCard data={spendByCountry} />}</div>
              <div>{isLoading ? <ChartSkeleton /> : <CustomerHealthCard health={health} />}</div>
              <div>{isLoading ? <ChartSkeleton /> : <TopCustomersCard items={topCustomers} totalValue={topTotalValue} />}</div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {isLoading ? (
                Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className={cn('h-24 animate-pulse rounded-xl border border-border bg-card')} />
                ))
              ) : (
                <>
                  <StatCard
                    icon={PieChart}
                    label={t('stats.segmentsReady')}
                    value={segmentsSummary ? formatNumber(segmentsSummary.count) : '—'}
                    hint={t('stats.savedAudiences')}
                  />
                  <StatCard
                    icon={Users}
                    label={t('stats.totalReach')}
                    value={segmentsSummary ? formatNumber(segmentsSummary.totalAudience) : '—'}
                    hint={t('stats.reachDescription')}
                    tone="accent"
                  />
                  <StatCard
                    icon={Target}
                    label={t('stats.avgAudience')}
                    value={segmentsSummary ? formatNumber(Math.round(segmentsSummary.averageAudience)) : '—'}
                    hint={t('stats.avgAudienceDescription')}
                  />
                </>
              )}
            </div>
          </>
        )}
      </div>
    </PageWrapper>
  )
}