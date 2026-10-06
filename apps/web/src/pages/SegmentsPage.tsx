import { useTranslation } from 'react-i18next'
import { PageWrapper } from '@/components/common/PageWrapper'
import { PageHeader } from '@/components/layout/PageHeader'
import { SegmentBuilder } from '@/features/segments/components/SegmentBuilder'
import { SegmentList } from '@/features/segments/components/SegmentList'

// Composition only — all logic lives in the feature hooks and components.
export default function SegmentsPage() {
  const { t } = useTranslation('segments')

  return (
    <PageWrapper>
      <div className="flex flex-col gap-4 p-4 sm:gap-6 sm:p-6 xl:p-8">
        <PageHeader title={t('title')} description={t('description')} />
        <div className="grid grid-cols-1 gap-4 sm:gap-6 xl:grid-cols-5">
          <div className="xl:col-span-3">
            <SegmentBuilder />
          </div>
          <div className="xl:col-span-2">
            <SegmentList />
          </div>
        </div>
      </div>
    </PageWrapper>
  )
}
