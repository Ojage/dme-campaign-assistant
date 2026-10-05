import { useTranslation } from 'react-i18next'
import { PageWrapper } from '@/components/common/PageWrapper'
import { PageHeader } from '@/components/layout/PageHeader'
import { AnimatePresence } from 'framer-motion'
import { CampaignForm } from '@/features/campaigns/components/CampaignForm'
import { CampaignResult } from '@/features/campaigns/components/CampaignResult'
import { RecentCampaigns } from '@/features/campaigns/components/RecentCampaigns'
import { useCampaignForm } from '@/features/campaigns/hooks/useCampaignForm'
import { useAssistantActivity } from '@/app/providers/AssistantActivityProvider'

// Composition only — all logic lives in the feature hook.
export default function CampaignsPage() {
  const { t } = useTranslation('campaigns')
  const form = useCampaignForm()

  // Generating is the long wait on this screen, so it holds the page-wide bar.
  useAssistantActivity('campaign-generate', form.isGenerating)

  return (
    <PageWrapper>
      <div className="flex flex-col gap-6 p-8">
        <PageHeader title={t('title')} description={t('description')} />
        <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-5">
          <div className="flex flex-col gap-6 xl:col-span-3">
            <CampaignForm form={form} />
            <AnimatePresence mode="wait">
              {form.result ? (
                <CampaignResult key={form.result.id} campaign={form.result} />
              ) : null}
            </AnimatePresence>
          </div>
          <div className="xl:col-span-2">
            <RecentCampaigns campaigns={form.recent} />
          </div>
        </div>
      </div>
    </PageWrapper>
  )
}
