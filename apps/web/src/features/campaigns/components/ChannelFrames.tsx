import { useTranslation } from 'react-i18next'
import { BatteryFull, ChevronRight, Signal, Smartphone, Wifi } from 'lucide-react'
import { motion } from 'framer-motion'
import type { GeneratedCampaign } from '../types/campaign.types'
import { CHANNEL_LIMITS, smsParts, truncate } from '../lib/channelInsights'

/** Splits copy the way a carrier does, so part boundaries are visible. */
function splitParts(message: string): string[] {
  if (message.length <= 160) return [message]
  const parts = [message.slice(0, 160)]
  let rest = message.slice(160)
  while (rest.length > 0) {
    parts.push(rest.slice(0, 153))
    rest = rest.slice(153)
  }
  return parts
}

interface FrameProps {
  campaign: GeneratedCampaign
}

/**
 * How the copy lands in a mail client. The message and button come straight from
 * the campaign; only the surrounding chrome is illustrative.
 */
export function EmailFrame({ campaign }: FrameProps) {
  const { t } = useTranslation('campaigns')

  return (
    <div className="bg-muted/30 p-4 sm:p-6">
      <div className="mx-auto max-w-2xl overflow-hidden rounded-lg border border-border bg-card shadow-sm">
        {/* Sender */}
        <div className="flex items-start gap-3 border-b border-border p-4">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/90 text-xs font-bold text-primary-foreground">
            DME
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">DME Cameroon</p>
            <p className="truncate text-xs text-muted-foreground">
              {t('preview.email.toLabel')} aicha.njoya@dme.cm
            </p>
          </div>
          <span className="shrink-0 text-[11px] text-muted-foreground">
            {t('preview.email.subjectLabel')}
          </span>
        </div>

        {/* Body */}
        <div className="space-y-4 p-5">
          <h3 className="text-lg font-bold leading-snug text-foreground">{campaign.title}</h3>
          <p className="whitespace-pre-line text-sm leading-relaxed text-foreground/90">{campaign.message}</p>

          {campaign.callToAction ? (
            <div>
              <motion.span
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm"
              >
                {campaign.callToAction}
                <ChevronRight className="h-4 w-4" />
              </motion.span>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="space-y-1 border-t border-border bg-muted/20 px-5 py-3 text-[11px] text-muted-foreground">
          <p>{t('preview.email.footer')}</p>
          <p className="underline">{t('preview.email.unsubscribe')}</p>
        </div>
      </div>
    </div>
  )
}

/** How the copy lands on a handset, including carrier part segmentation. */
export function SmsFrame({ campaign }: FrameProps) {
  const { t } = useTranslation('campaigns')
  const message = campaign.message.trim()
  const parts = splitParts(message)
  const limit = CHANNEL_LIMITS.sms.body

  return (
    <div className="bg-muted/30 p-4 sm:p-6">
      <div className="mx-auto w-full max-w-[360px] overflow-hidden rounded-[2rem] border-4 border-foreground/80 bg-background shadow-lg">
        {/* Status bar */}
        <div className="flex items-center justify-between px-5 pb-1 pt-2.5 text-[11px] font-medium text-foreground">
          <span>{t('preview.sms.time')}</span>
          <div className="flex items-center gap-1" aria-hidden>
            <Signal className="h-3 w-3" />
            <Wifi className="h-3 w-3" />
            <BatteryFull className="h-3.5 w-3.5" />
          </div>
        </div>

        {/* Thread header */}
        <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
          <Smartphone className="h-4 w-4 text-muted-foreground" aria-hidden />
          <span className="text-sm font-semibold text-foreground">{campaign.segmentName}</span>
        </div>

        {/* Bubbles */}
        <div className="space-y-2 px-4 py-4">
          {parts.map((part, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: index * 0.1 }}
              className="ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-3.5 py-2 text-sm leading-relaxed text-primary-foreground"
            >
              <p className="whitespace-pre-line">{part}</p>
              <p className="mt-1 text-right text-[10px] opacity-70">
                {parts.length > 1 ? `${t('preview.sms.part', { index: index + 1, total: parts.length })} · ` : ''}
                {part.length}/{limit.target}
              </p>
            </motion.div>
          ))}
        </div>

        <div className="px-4 pb-4 text-center text-[10px] text-muted-foreground">
          {t('preview.sms.total', { length: message.length, parts: smsParts(message.length) })}
        </div>
      </div>
    </div>
  )
}

/** How the copy lands as a lock-screen notification, including truncation. */
export function PushFrame({ campaign }: FrameProps) {
  const { t } = useTranslation('campaigns')
  const limit = CHANNEL_LIMITS.push.body
  const body = campaign.message.trim()
  const title = campaign.title.trim()
  const truncated = body.length > limit.max || title.length > limit.target
  const shownBody = truncate(body, limit.target)
  const shownTitle = truncate(title, limit.target)

  return (
    <div className="bg-muted/30 p-4 sm:p-6">
      <div className="mx-auto w-full max-w-[360px] space-y-3">
        {/* Notification */}
        <motion.div
          initial={{ opacity: 0, y: -14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 26 }}
          className="rounded-2xl border border-border bg-card/95 p-3.5 shadow-lg backdrop-blur"
        >
          <div className="flex items-center gap-2">
            <div className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-primary text-[10px] font-bold text-primary-foreground">
              D
            </div>
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {t('preview.push.now')}
            </span>
          </div>
          <p className="mt-2 text-sm font-semibold leading-snug text-foreground">{shownTitle}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-foreground/80">{shownBody}</p>
        </motion.div>

        {/* App surface */}
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
            <Smartphone className="h-4 w-4 text-muted-foreground" aria-hidden />
            <span className="text-sm font-semibold text-foreground">{t('preview.push.appName')}</span>
          </div>
          <div className="px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t('preview.push.notification')}
            </p>
            <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-foreground">
              {truncate(body, limit.max)}
            </p>
          </div>
        </div>

        {truncated ? (
          <p className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-[11px] text-warning">
            {t('preview.push.truncated', { max: limit.max })}
          </p>
        ) : null}
      </div>
    </div>
  )
}