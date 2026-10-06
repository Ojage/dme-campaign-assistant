import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  BellRing,
  Check,
  Copy,
  Mail,
  Maximize2,
  MessageSquare,
  Minimize2,
  Monitor,
  Smartphone,
  Sparkles,
  X,
} from 'lucide-react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/common/Button'
import { cn } from '@/lib/utils'
import { formatDateTime } from '@/utils/formatters'
import { BrowserFrame, type PreviewDevice } from './BrowserFrame'
import { EmailFrame, PushFrame, SmsFrame } from './ChannelFrames'
import { QualityChecklist } from './QualityChecklist'
import { TestSendPanel } from './TestSendPanel'
import { analyseCampaign, CHANNEL_LIMITS } from '../lib/channelInsights'
import type { CampaignChannel, GeneratedCampaign } from '../types/campaign.types'

const CHANNELS = [
  { value: 'sms', icon: MessageSquare },
  { value: 'email', icon: Mail },
  { value: 'push', icon: BellRing },
] as const satisfies ReadonlyArray<{ value: CampaignChannel; icon: typeof Mail }>

const STATUS_VARIANT = {
  draft: 'secondary',
  ready: 'success',
  sent: 'outline',
} as const

/** The address bar text. A preview host, so it is never mistaken for a live link. */
function previewUrl(campaign: GeneratedCampaign): string {
  return `preview.dme.cm/campaigns/${campaign.id.slice(0, 8)}`
}

interface CampaignPreviewProps {
  campaign: GeneratedCampaign
}

export function CampaignPreview({ campaign }: CampaignPreviewProps) {
  const { t } = useTranslation('campaigns')
  const [device, setDevice] = useState<PreviewDevice>('desktop')
  const [channel, setChannel] = useState<CampaignChannel>(campaign.channel)
  const [focused, setFocused] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!focused) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setFocused(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [focused])

  const insights = useMemo(() => analyseCampaign(campaign, channel), [campaign, channel])
  const limit = CHANNEL_LIMITS[channel].body
  const length = campaign.message.trim().length

  const copy = async () => {
    await navigator.clipboard.writeText(campaign.message)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1_500)
  }

  const body = (
    <>
      {/* Header */}
      <CardHeader className="border-b border-border">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Sparkles className="h-5 w-5 shrink-0 text-accent" aria-hidden />
              <span className="truncate">{campaign.title}</span>
            </CardTitle>
            <CardDescription className="mt-1 flex flex-wrap items-center gap-1.5">
              <span>{t('result.targeting', { segment: campaign.segmentName })}</span>
              <span aria-hidden>·</span>
              <span>{t('result.generatedAt', { date: formatDateTime(campaign.generatedAt) })}</span>
            </CardDescription>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={STATUS_VARIANT[campaign.status]}>{t(`status.${campaign.status}`)}</Badge>
            <Badge variant="outline">{t(`form.tones.${campaign.tone}`)}</Badge>

            <div className="flex items-center rounded-lg border border-border" role="group" aria-label={t('preview.device')}>
              {(['desktop', 'mobile'] as const).map((mode) => {
                const Icon = mode === 'desktop' ? Monitor : Smartphone
                return (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setDevice(mode)}
                    aria-pressed={device === mode}
                    aria-label={t(`preview.devices.${mode}`)}
                    className={cn(
                      'p-1.5 transition-colors',
                      device === mode ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted',
                    )}
                  >
                    <Icon className="h-4 w-4" aria-hidden />
                  </button>
                )
              })}
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => void copy()}
              aria-label={copied ? t('result.copied') : t('result.copy')}
              className="h-9 w-9"
            >
              {copied ? <Check className="h-4 w-4 text-success" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setFocused((value) => !value)}
              aria-label={focused ? t('preview.exitFocus') : t('preview.focus')}
              className="h-9 w-9"
            >
              {focused ? <Minimize2 className="h-4 w-4" aria-hidden /> : <Maximize2 className="h-4 w-4" aria-hidden />}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="grid grid-cols-1 gap-5 xl:grid-cols-5">
        {/* Preview */}
        <div className="space-y-3 xl:col-span-3">
          {/* Channel tabs */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/40 p-1">
              {CHANNELS.map(({ value, icon: Icon }) => {
                const active = channel === value
                return (
                  <motion.button
                    key={value}
                    type="button"
                    whileTap={{ scale: 0.96 }}
                    onClick={() => setChannel(value)}
                    aria-pressed={active}
                    className={cn(
                      'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors',
                      active ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" aria-hidden />
                    {t(`form.channels.${value}`)}
                  </motion.button>
                )
              })}
            </div>

            <p
              className={cn(
                'shrink-0 text-[11px] font-medium',
                length > limit.max ? 'text-destructive' : length > limit.target ? 'text-warning' : 'text-muted-foreground',
              )}
            >
              {t('preview.characters', { length, target: limit.target })}
            </p>
          </div>

          {channel !== campaign.channel ? (
            <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground">
              {t('preview.channelMismatch', { generated: t(`form.channels.${campaign.channel}`), shown: t(`form.channels.${channel}`) })}
            </p>
          ) : null}

          <BrowserFrame title={campaign.title} url={previewUrl(campaign)} device={device}>
            {channel === 'email' ? (
              <EmailFrame campaign={campaign} />
            ) : channel === 'sms' ? (
              <SmsFrame campaign={campaign} />
            ) : (
              <PushFrame campaign={campaign} />
            )}
          </BrowserFrame>

          <p className="text-[11px] italic text-muted-foreground">{t('preview.simulation')}</p>
        </div>

        {/* Checks and test send */}
        <div className="space-y-4 xl:col-span-2">
          <QualityChecklist insights={insights} />
          <TestSendPanel campaign={campaign} />
        </div>
      </CardContent>
    </>
  )

  if (!focused) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <Card className="overflow-hidden border-primary/30">{body}</Card>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 overflow-y-auto bg-background/95 p-4 backdrop-blur-sm sm:p-8"
      role="dialog"
      aria-modal="true"
      aria-label={t('preview.focus')}
    >
      <div className="mx-auto max-w-6xl">
        <div className="mb-3 flex justify-end">
          <Button variant="outline" size="sm" leftIcon={<X className="h-3.5 w-3.5" />} onClick={() => setFocused(false)}>
            {t('preview.exitFocus')}
          </Button>
        </div>
        <Card className="overflow-hidden">{body}</Card>
      </div>
    </motion.div>
  )
}