import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Save, Users } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/common/Button'
import { ConditionRow } from '@/features/segments/components/ConditionRow'
import { useSegmentBuilder } from '@/features/segments/hooks/useSegmentBuilder'
import type { Segment } from '@/features/segments/types/segment.types'
import { getCountries } from '@/features/customers/api/customersApi'

interface SegmentBuilderProps {
  onCreated?: (segment: Segment) => void
}

export function SegmentBuilder({ onCreated }: SegmentBuilderProps) {
  const { t } = useTranslation('segments')
  const builder = useSegmentBuilder(onCreated)
  const [countries, setCountries] = useState<string[]>([])

  useEffect(() => {
    void getCountries().then(setCountries)
  }, [])

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('builder.title')}</CardTitle>
        <CardDescription>{t('builder.description')}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="space-y-1.5">
          <label htmlFor="segment-name" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t('builder.name')}
          </label>
          <Input
            id="segment-name"
            value={builder.name}
            onChange={(e) => builder.setName(e.target.value)}
            placeholder={t('builder.namePlaceholder')}
          />
        </div>

        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('builder.conditions')}</p>
          {builder.conditions.map((condition) => (
            <ConditionRow
              key={condition.id}
              condition={condition}
              countries={countries}
              canRemove={builder.conditions.length > 1}
              onChange={(patch) => builder.updateCondition(condition.id, patch)}
              onRemove={() => builder.removeCondition(condition.id)}
            />
          ))}
          <Button variant="outline" size="sm" leftIcon={<Plus className="h-4 w-4" />} onClick={builder.addCondition}>
            {t('builder.addCondition')}
          </Button>
        </div>

        {/* Live audience preview */}
        <div className="flex items-center justify-between rounded-lg border border-border bg-muted/40 px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="h-4 w-4" />
            <span>{t('builder.audience')}</span>
          </div>
          <span className="text-lg font-bold tabular-nums text-accent">
            {builder.isPreviewing ? '…' : builder.matchCount === null ? '—' : builder.matchCount}
          </span>
        </div>

        {builder.error ? <p className="text-sm text-destructive">{builder.error}</p> : null}
        {builder.savedName ? (
          <p className="text-sm text-success">{t('builder.saved', { name: builder.savedName })}</p>
        ) : null}

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2">
          <Button leftIcon={<Save className="h-4 w-4" />} isLoading={builder.isSaving} onClick={() => void builder.save()} className="w-full sm:w-auto">
            {t('builder.save')}
          </Button>
          <Button variant="ghost" onClick={builder.reset} className="w-full sm:w-auto">
            {t('builder.clear')}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export function SegmentBuilderSkeleton() {
  return (
    <div className="h-[480px] animate-pulse rounded-xl border border-border bg-card" />
  )
}
