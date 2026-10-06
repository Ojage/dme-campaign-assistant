import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BellRing, Check, Mail, MessageSquare, Send, FlaskConical, Sparkles } from 'lucide-react'
import { motion } from 'framer-motion'
import { Button } from '@/components/common/Button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { useAuth } from '@/features/auth/hooks/useAuth'
import type { CampaignChannel, GeneratedCampaign } from '../types/campaign.types'

const CHANNELS = [
  { value: 'sms', icon: MessageSquare },
  { value: 'email', icon: Mail },
  { value: 'push', icon: BellRing },
] as const satisfies ReadonlyArray<{ value: CampaignChannel; icon: typeof Mail }>

interface TestSendPanelProps {
  campaign: GeneratedCampaign
}

/**
 * Test send — announced, not faked.
 *
 * There is no delivery endpoint behind this yet, so the panel states the
 * destination, lets the operator pick a channel, and keeps the action disabled
 * with an explicit "soon" badge. No simulated success is ever reported.
 */
export function TestSendPanel({ campaign }: TestSendPanelProps) {
  const { t } = useTranslation('campaigns')
  const { user } = useAuth()
  const [channel, setChannel] = useState<CampaignChannel>(campaign.channel)

  return (
    <div className="rounded-xl border border-dashed border-primary/40 bg-primary/5">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-primary/20 px-4 py-3">
        <div className="flex items-center gap-2">
          <FlaskConical className="h-4 w-4 text-primary" aria-hidden />
          <h4 className="text-sm font-semibold text-foreground">{t('testSend.title')}</h4>
        </div>
        <Badge variant="warning">{t('testSend.comingSoon')}</Badge>
      </div>

      <div className="space-y-4 p-4">
        <p className="text-xs leading-relaxed text-muted-foreground">{t('testSend.description')}</p>

        {/* Destination */}
        <div className="rounded-lg border border-border bg-card px-3 py-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {t('testSend.destination')}
          </p>
          <p className="mt-0.5 truncate text-sm font-medium text-foreground">
            {user?.email ?? t('testSend.destinationFallback')}
          </p>
        </div>

        {/* Channel choice */}
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {t('testSend.channel')}
          </p>
          <div className="grid grid-cols-3 gap-2">
            {CHANNELS.map(({ value, icon: Icon }) => {
              const selected = channel === value
              const isGenerated = value === campaign.channel
              return (
                <motion.button
                  key={value}
                  type="button"
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setChannel(value)}
                  aria-pressed={selected}
                  className={cn(
                    'relative flex flex-col items-center gap-1.5 rounded-lg border px-2 py-3 transition-colors',
                    selected ? 'border-primary bg-primary/10 ring-1 ring-primary' : 'border-border bg-card hover:bg-muted/50',
                  )}
                >
                  <Icon className={cn('h-4 w-4', selected ? 'text-primary' : 'text-muted-foreground')} aria-hidden />
                  <span className={cn('text-xs font-semibold', selected ? 'text-primary' : 'text-foreground')}>
                    {t(`form.channels.${value}`)}
                  </span>
                  {isGenerated ? (
                    <span className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
                      {t('testSend.generatedFor')}
                    </span>
                  ) : null}
                </motion.button>
              )
            })}
          </div>
        </div>

        {/* Action, deliberately inert */}
        <Button size="lg" disabled leftIcon={<Send className="h-4 w-4" />} className="w-full">
          {t('testSend.action')}
        </Button>

        <ul className="space-y-1.5">
          {['testSend.noteDelivery', 'testSend.noteRenders', 'testSend.noteSafe'].map((key, index) => (
            <motion.li
              key={key}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: index * 0.06 }}
              className="flex items-start gap-2 text-[11px] text-muted-foreground"
            >
              <Check className="mt-0.5 h-3 w-3 shrink-0 text-success" aria-hidden />
              {t(key)}
            </motion.li>
          ))}
        </ul>

        <p className="flex items-center gap-1.5 text-[11px] italic text-muted-foreground">
          <Sparkles className="h-3 w-3 shrink-0" aria-hidden />
          {t('testSend.roadmap')}
        </p>
      </div>
    </div>
  )
}