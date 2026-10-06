import { useTranslation } from 'react-i18next'
import { Sparkles, Wand2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/common/Button'
import { ChannelSelector } from '@/features/campaigns/components/ChannelSelector'
import { ToneSelector } from '@/features/campaigns/components/ToneSelector'
import type { useCampaignForm } from '@/features/campaigns/hooks/useCampaignForm'

type Form = ReturnType<typeof useCampaignForm>

export function CampaignForm({ form }: { form: Form }) {
  const { t } = useTranslation('campaigns')

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wand2 className="h-5 w-5 text-primary" />
          {t('form.title')}
        </CardTitle>
        <CardDescription>{t('form.description')}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="space-y-1.5">
          <label htmlFor="segment" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t('form.segment')}
          </label>
          <Select value={form.form.segmentId} onValueChange={(v) => form.update('segmentId', v)}>
            <SelectTrigger id="segment">
              <SelectValue placeholder={t('form.segmentPlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              {form.segments.map((segment) => (
                <SelectItem key={segment.id} value={segment.id}>
                  {segment.name} ({segment.matchCount})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="objective" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t('form.objective')}
          </label>
          <Input
            id="objective"
            value={form.form.objective}
            onChange={(e) => form.update('objective', e.target.value)}
            placeholder={t('form.objectivePlaceholder')}
          />
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('form.channel')}</p>
          <ChannelSelector value={form.form.channel} onChange={(channel) => form.update('channel', channel)} />
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('form.tone')}</p>
          <ToneSelector value={form.form.tone} onChange={(tone) => form.update('tone', tone)} />
        </div>

        {form.error ? <p className="text-sm text-destructive">{form.error}</p> : null}

        <Button
          size="lg"
          leftIcon={<Sparkles className="h-4 w-4" />}
          isLoading={form.isGenerating}
          onClick={() => void form.generate()}
          className="w-full sm:w-auto"
        >
          {form.isGenerating ? t('form.generating') : t('form.generate')}
        </Button>
      </CardContent>
    </Card>
  )
}

export function CampaignFormSkeleton() {
  return <div className="h-[560px] animate-pulse rounded-xl border border-border bg-card" />
}
