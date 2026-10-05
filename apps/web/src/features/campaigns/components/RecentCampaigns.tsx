import { useTranslation } from 'react-i18next'
import { History } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatDateTime } from '@/utils/formatters'
import type { GeneratedCampaign } from '@/features/campaigns/types/campaign.types'

export function RecentCampaigns({ campaigns }: { campaigns: GeneratedCampaign[] }) {
  const { t } = useTranslation('campaigns')

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5 text-muted-foreground" />
          {t('recent.title')}
        </CardTitle>
        <CardDescription>{t('recent.description')}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {campaigns.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">{t('recent.none')}</p>
        ) : (
          campaigns.slice(0, 6).map((campaign) => (
            <div key={campaign.id} className="rounded-lg border border-border px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-foreground">{campaign.title}</p>
                <Badge variant="outline">{t(`form.channels.${campaign.channel}`)}</Badge>
              </div>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {campaign.segmentName} · {formatDateTime(campaign.generatedAt)}
              </p>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}
