import { useTranslation } from 'react-i18next'
import { Trash2, PieChart } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/common/Button'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorMessage } from '@/components/common/ErrorMessage'
import { formatDate, formatXaf } from '@/utils/formatters'
import {
  SegmentConditionField,
  SegmentConditionOperator,
  type Segment,
} from '@/features/segments/types/segment.types'
import { useSegments } from '@/features/segments/hooks/useSegments'
import { useFocusFlash } from '@/features/search/hooks/useFocusFlash'
import { cn } from '@/lib/utils'

const FIELD_KEYS: Record<SegmentConditionField, string> = {
  [SegmentConditionField.TOTAL_AMOUNT_SPENT]: 'totalAmountSpent',
  [SegmentConditionField.TOTAL_TRANSACTIONS]: 'totalTransactions',
  [SegmentConditionField.LAST_ACTIVITY_DAYS]: 'lastActivityDays',
  [SegmentConditionField.COUNTRY]: 'country',
}

const OPERATOR_KEYS: Record<SegmentConditionOperator, string> = {
  [SegmentConditionOperator.GREATER_THAN]: 'gt',
  [SegmentConditionOperator.LESS_THAN]: 'lt',
  [SegmentConditionOperator.EQUALS]: 'eq',
}

function describeCondition(segment: Segment, format: (field: SegmentConditionField, value: string | number) => string, t: (key: string) => string): string {
  return segment.conditions
    .map((c) => `${t(`fields.${FIELD_KEYS[c.field]}`)} ${t(`operators.${OPERATOR_KEYS[c.operator]}`)} ${format(c.field, c.value)}`)
    .join(' · ')
}

export function SegmentList() {
  const { t } = useTranslation('segments')
  const { segments, isLoading, error, deletingId, reload, deleteSegment } = useSegments()
  const { flashId, flashTarget, flashClass } = useFocusFlash('segments')

  const formatValue = (field: SegmentConditionField, value: string | number): string =>
    field === SegmentConditionField.TOTAL_AMOUNT_SPENT ? formatXaf(Number(value)) : String(value)

  if (error) return <ErrorMessage message={error} onRetry={reload} />

  return (
    <Card data-focus-section="segments" className={cn(flashTarget === 'section' && flashClass)}>
      <CardHeader>
        <CardTitle>{t('list.title')}</CardTitle>
        <CardDescription>{t('list.description')}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-lg border border-border bg-card" />
          ))
        ) : segments.length === 0 ? (
          <EmptyState
            icon={PieChart}
            title={t('list.empty.title')}
            description={t('list.empty.description')}
          />
        ) : (
          segments.map((segment) => (
            <div
              key={segment.id}
              data-focus-id={segment.id}
              className={cn(
                'flex items-center justify-between gap-4 rounded-lg border border-border bg-card px-4 py-3 transition-colors hover:bg-muted/40',
                segment.id === flashId &&
                flashTarget === 'row' &&
                flashClass,
              )}
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-semibold text-foreground">{segment.name}</p>
                  <Badge className="bg-accent/15 text-accent hover:bg-accent/15">
                    {t('list.customers', { n: segment.matchCount })}
                  </Badge>
                </div>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {describeCondition(segment, formatValue, t)} · {t('list.created', { date: formatDate(segment.createdAt) })}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="shrink-0 text-muted-foreground hover:text-destructive"
                disabled={deletingId === segment.id}
                onClick={() => void deleteSegment(segment.id)}
                aria-label={t('list.delete', { name: segment.name })}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}
