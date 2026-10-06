import { useTranslation } from 'react-i18next'
import { History } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatDateTime } from '@/utils/formatters'
import type { GeneratedCampaign } from '@/features/campaigns/types/campaign.types'
import { useFocusFlash } from '@/features/search/hooks/useFocusFlash'
import { cn } from '@/lib/utils'

/** Status chips mirror the dashboard's semantic colours. */
const STATUS_CLASSES: Record<GeneratedCampaign['status'], string> = {
  draft: 'bg-muted text-muted-foreground',
  ready: 'bg-success/15 text-success',
  sent: 'bg-accent/15 text-accent',
} as const

export function RecentCampaigns({ campaigns }: { campaigns: GeneratedCampaign[] }) {
  const { t } = useTranslation('campaigns')
  const { flashId, flashTarget, flashClass } = useFocusFlash('campaigns')

  return (
    <Card data-focus-section="campaigns" className={cn(flashTarget === 'section' && flashClass)}>
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
            <div
              key={campaign.id}
              data-focus-id={campaign.id}
              className={cn(
                'rounded-lg border border-border px-4 py-3',
                campaign.id === flashId && flashTarget === 'row' && flashClass,
              )}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-foreground">{campaign.title}</p>
                <span className="flex items-center gap-2">
                  <Badge variant="outline">{t(`form.channels.${campaign.channel}`)}</Badge>
                  <span
                    className={cn(
                      'inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold',
                      STATUS_CLASSES[campaign.status],
                    )}
                  >
                    {t(`status.${campaign.status}`)}
                  </span>
                </span>
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
