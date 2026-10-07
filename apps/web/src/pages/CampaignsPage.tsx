import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PageWrapper } from '@/components/common/PageWrapper'
import { PageHeader } from '@/components/layout/PageHeader'
import { Confetti } from '@/components/common/Confetti'
import { AnimatePresence } from 'framer-motion'
import { CampaignForm } from '@/features/campaigns/components/CampaignForm'
import { CampaignPreview } from '@/features/campaigns/components/CampaignPreview'
import { RecentCampaigns } from '@/features/campaigns/components/RecentCampaigns'
import { useCampaignForm } from '@/features/campaigns/hooks/useCampaignForm'
import type { GeneratedCampaign } from '@/features/campaigns/types/campaign.types'
import { useAssistantActivity } from '@/app/providers/AssistantActivityProvider'

// Composition only — all logic lives in the feature hook.
export default function CampaignsPage() {
  const { t } = useTranslation('campaigns')
  const form = useCampaignForm()
  const [burst, setBurst] = useState(0)
  const previewRef = useRef<HTMLDivElement>(null)

  // Generating is the long wait on this screen, so it holds the page-wide bar.
  useAssistantActivity('campaign-generate', form.isGenerating)

  // Celebrate each newly generated campaign, but never for one reopened from
  // history — the hook clears `celebrateId` the moment it is reopened.
  const celebrateId = form.celebrateId
  useEffect(() => {
    if (celebrateId) setBurst((n) => n + 1)
  }, [celebrateId])

  const openCampaign = (campaign: GeneratedCampaign) => {
    form.openCampaign(campaign)
    // On phones history sits below the preview, so pull the preview into view.
    previewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <PageWrapper>
      <Confetti fire={burst} />

      <div className="flex flex-col gap-4 p-4 sm:gap-6 sm:p-6 xl:p-8">
        <PageHeader title={t('title')} description={t('description')} />
        <div className="grid grid-cols-1 items-start gap-4 sm:gap-6 xl:grid-cols-5">
          <div className="flex flex-col gap-6 xl:col-span-3">
            <CampaignForm form={form} />
            <div ref={previewRef} className="scroll-mt-4">
              <AnimatePresence mode="wait">
                {form.result ? <CampaignPreview key={form.result.id} campaign={form.result} /> : null}
              </AnimatePresence>
            </div>
          </div>
          <div className="xl:col-span-2">
            <RecentCampaigns campaigns={form.recent} onSelect={openCampaign} selectedId={form.result?.id} />
          </div>
        </div>
      </div>
    </PageWrapper>
  )
}
