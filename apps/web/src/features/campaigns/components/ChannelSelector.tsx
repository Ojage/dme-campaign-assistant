import { useTranslation } from 'react-i18next'
import { MessageSquare, Mail, BellRing } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CampaignChannel } from '@/features/campaigns/types/campaign.types'
import { motion } from 'framer-motion'

const CHANNELS: Array<{ value: CampaignChannel; labelKey: string; icon: typeof Mail }> = [
  { value: CampaignChannel.SMS, labelKey: 'sms', icon: MessageSquare },
  { value: CampaignChannel.EMAIL, labelKey: 'email', icon: Mail },
  { value: CampaignChannel.PUSH, labelKey: 'push', icon: BellRing },
]

interface ChannelSelectorProps {
  value: CampaignChannel
  onChange: (channel: CampaignChannel) => void
}

export function ChannelSelector({ value, onChange }: ChannelSelectorProps) {
  const { t } = useTranslation('campaigns')

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {CHANNELS.map(({ value: channel, labelKey, icon: Icon }) => {
        const selected = value === channel
        return (
          <motion.button
            key={channel}
            type="button"
            whileTap={{ scale: 0.98 }}
            onClick={() => onChange(channel)}
            aria-pressed={selected}
            className={cn(
              'flex flex-col items-start gap-1.5 rounded-xl border p-4 text-left transition-colors',
              selected
                ? 'border-primary bg-primary/5 ring-1 ring-primary'
                : 'border-border bg-card hover:bg-muted/50',
            )}
          >
            <Icon className={cn('h-5 w-5', selected ? 'text-primary' : 'text-muted-foreground')} />
            <span className={cn('text-sm font-semibold', selected ? 'text-primary' : 'text-foreground')}>
              {t(`form.channels.${labelKey}`)}
            </span>
            <span className="text-xs text-muted-foreground">{t(`form.channelHints.${labelKey}`)}</span>
          </motion.button>
        )
      })}
    </div>
  )
}
