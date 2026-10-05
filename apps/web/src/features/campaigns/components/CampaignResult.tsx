import { Sparkles, Copy, Check, Send } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/common/Button'
import { formatDateTime } from '@/utils/formatters'
import { type GeneratedCampaign } from '@/features/campaigns/types/campaign.types'

function CopyButton({ text, label, copiedLabel }: { text: string; label: string; copiedLabel: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1_500)
  }
  return (
    <Button variant="ghost" size="sm" onClick={() => void copy()} className="text-muted-foreground hover:text-foreground">
      {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? copiedLabel : label}
    </Button>
  )
}

export function CampaignResult({ campaign }: { campaign: GeneratedCampaign }) {
  const { t } = useTranslation('campaigns')

  const channelLabel = t(`form.channels.${campaign.channel}`)
  const toneLabel = t(`form.tones.${campaign.tone}`)

  return (
    <Card className="border-primary/30">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="h-5 w-5 text-accent" />
            {campaign.title}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{channelLabel}</Badge>
            <Badge variant="outline">{toneLabel}</Badge>
          </div>
        </div>
        <CardDescription>
          {t('result.targeting', { segment: campaign.segmentName })} ·{' '}
          {t('result.generatedAt', { date: formatDateTime(campaign.generatedAt) })}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="rounded-lg border border-border bg-muted/40 p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('result.message')}</p>
            <CopyButton text={campaign.message} label={t('result.copy')} copiedLabel={t('result.copied')} />
          </div>
          <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-foreground">{campaign.message}</p>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/25 bg-primary/5 px-4 py-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-primary/80">{t('result.callToAction')}</p>
            <p className="mt-0.5 text-sm font-semibold text-foreground">{campaign.callToAction}</p>
          </div>
          <Button size="sm" leftIcon={<Send className="h-3.5 w-3.5" />}>
            {t('result.approve')}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
