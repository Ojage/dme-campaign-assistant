import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PageWrapper } from '@/components/common/PageWrapper'
import { PageHeader } from '@/components/layout/PageHeader'
import { Confetti } from '@/components/common/Confetti'
import { AnimatePresence } from 'framer-motion'
import { CampaignForm } from '@/features/campaigns/components/CampaignForm'
import { CampaignPreview } from '@/features/campaigns/components/CampaignPreview'
import { RecentCampaigns } from '@/features/campaigns/components/RecentCampaigns'
import { useCampaignForm } from '@/features/campaigns/hooks/useCampaignForm'
import { useAssistantActivity } from '@/app/providers/AssistantActivityProvider'

// Composition only — all logic lives in the feature hook.
export default function CampaignsPage() {
  const { t } = useTranslation('campaigns')
  const form = useCampaignForm()
  const [burst, setBurst] = useState(0)

  // Generating is the long wait on this screen, so it holds the page-wide bar.
  useAssistantActivity('campaign-generate', form.isGenerating)

  // Celebrate each new campaign, but only when the id actually changes so a
  // re-render (or a cache invalidation) never replays the burst.
  const resultId = form.result?.id
  useEffect(() => {
    if (resultId) setBurst((n) => n + 1)
  }, [resultId])

  return (
    <PageWrapper>
      <Confetti fire={burst} />

      <div className="flex flex-col gap-4 p-4 sm:gap-6 sm:p-6 xl:p-8">
        <PageHeader title={t('title')} description={t('description')} />
        <div className="grid grid-cols-1 items-start gap-4 sm:gap-6 xl:grid-cols-5">
          <div className="flex flex-col gap-6 xl:col-span-3">
            <CampaignForm form={form} />
            <AnimatePresence mode="wait">
              {form.result ? <CampaignPreview key={form.result.id} campaign={form.result} /> : null}
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
