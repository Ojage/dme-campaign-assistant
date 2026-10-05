import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { CampaignTone } from '@/features/campaigns/types/campaign.types'

const TONES: Array<{ value: CampaignTone; labelKey: string }> = [
  { value: CampaignTone.PROFESSIONAL, labelKey: 'professional' },
  { value: CampaignTone.FRIENDLY, labelKey: 'friendly' },
  { value: CampaignTone.URGENT, labelKey: 'urgent' },
  { value: CampaignTone.PROMOTIONAL, labelKey: 'promotional' },
]

interface ToneSelectorProps {
  value: CampaignTone
  onChange: (tone: CampaignTone) => void
}

export function ToneSelector({ value, onChange }: ToneSelectorProps) {
  const { t } = useTranslation('campaigns')

  return (
    <div className="flex flex-wrap gap-2">
      {TONES.map(({ value: tone, labelKey }) => {
        const selected = value === tone
        return (
          <button
            key={tone}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(tone)}
            className={cn(
              'rounded-full border px-4 py-1.5 text-sm font-medium transition-colors',
              selected
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-card text-foreground hover:bg-muted/60',
            )}
          >
            {t(`form.tones.${labelKey}`)}
          </button>
        )
      })}
    </div>
  )
}
