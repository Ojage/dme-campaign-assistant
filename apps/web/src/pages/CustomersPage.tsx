import { useTranslation } from 'react-i18next'
import { PageWrapper } from '@/components/common/PageWrapper'
import { PageHeader } from '@/components/layout/PageHeader'
import { KPISection } from '@/features/customers/components/KPISection'
import { CustomerTable } from '@/features/customers/components/CustomerTable'
import { useCustomerKPIs } from '@/features/customers/hooks/useCustomerKPIs'

// Composition only — all logic lives in the feature hooks and components.
export default function CustomersPage() {
  const { t } = useTranslation('customers')
  const { kpis, isLoading } = useCustomerKPIs()

  return (
    <PageWrapper>
      <div className="flex flex-col gap-4 p-4 sm:gap-6 sm:p-6 xl:p-8">
        <PageHeader title={t('title')} description={t('description')} />
        <KPISection kpis={kpis} isLoading={isLoading} />
        <CustomerTable />
      </div>
    </PageWrapper>
  )
}
