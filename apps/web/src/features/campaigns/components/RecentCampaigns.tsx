import { useTranslation } from 'react-i18next'
import { ChevronRight, History } from 'lucide-react'
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

interface RecentCampaignsProps {
  campaigns: GeneratedCampaign[]
  /** Opens a campaign in the preview pane — works for anything from history, not just the last generation. */
  onSelect: (campaign: GeneratedCampaign) => void
  /** Id of the campaign currently shown in the preview, if any. */
  selectedId?: string
}

export function RecentCampaigns({ campaigns, onSelect, selectedId }: RecentCampaignsProps) {
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
          campaigns.slice(0, 6).map((campaign) => {
            const active = campaign.id === selectedId
            return (
              <button
                key={campaign.id}
                type="button"
                onClick={() => onSelect(campaign)}
                data-focus-id={campaign.id}
                aria-pressed={active}
                aria-label={`${t('recent.view')}: ${campaign.title}`}
                className={cn(
                  'group flex w-full items-center gap-2 rounded-lg border px-4 py-3 text-left transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
                  active
                    ? 'border-primary/50 bg-primary/5'
                    : 'border-border hover:border-primary/40 hover:bg-muted/40',
                  campaign.id === flashId && flashTarget === 'row' && flashClass,
                )}
              >
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-foreground">{campaign.title}</span>
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
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                    {campaign.segmentName} · {formatDateTime(campaign.generatedAt)}
                  </span>
                </span>
                <ChevronRight
                  className={cn(
                    'h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5',
                    active && 'translate-x-0.5 text-primary',
                  )}
                  aria-hidden
                />
              </button>
            )
          })
        )}
      </CardContent>
    </Card>
  )
}
