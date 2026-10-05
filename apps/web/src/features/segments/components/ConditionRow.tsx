import { useTranslation } from 'react-i18next'
import { Trash2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/common/Button'
import { SegmentConditionField, SegmentConditionOperator } from '@/features/segments/types/segment.types'
import type { DraftCondition } from '@/features/segments/hooks/useSegmentBuilder'

interface ConditionRowProps {
  condition: DraftCondition
  countries: string[]
  canRemove: boolean
  onChange: (patch: Partial<Omit<DraftCondition, 'id'>>) => void
  onRemove: () => void
}

const OPERATORS_BY_FIELD: Record<SegmentConditionField, SegmentConditionOperator[]> = {
  [SegmentConditionField.TOTAL_AMOUNT_SPENT]: [
    SegmentConditionOperator.GREATER_THAN,
    SegmentConditionOperator.LESS_THAN,
    SegmentConditionOperator.EQUALS,
  ],
  [SegmentConditionField.TOTAL_TRANSACTIONS]: [
    SegmentConditionOperator.GREATER_THAN,
    SegmentConditionOperator.LESS_THAN,
    SegmentConditionOperator.EQUALS,
  ],
  [SegmentConditionField.LAST_ACTIVITY_DAYS]: [
    SegmentConditionOperator.GREATER_THAN,
    SegmentConditionOperator.LESS_THAN,
  ],
  [SegmentConditionField.COUNTRY]: [SegmentConditionOperator.EQUALS],
}

const PLACEHOLDER_BY_FIELD: Record<SegmentConditionField, string> = {
  [SegmentConditionField.TOTAL_AMOUNT_SPENT]: 'amount',
  [SegmentConditionField.TOTAL_TRANSACTIONS]: 'transactions',
  [SegmentConditionField.LAST_ACTIVITY_DAYS]: 'days',
  [SegmentConditionField.COUNTRY]: 'country',
}

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

export function ConditionRow({ condition, countries, canRemove, onChange, onRemove }: ConditionRowProps) {
  const { t } = useTranslation('segments')
  const isCountry = condition.field === SegmentConditionField.COUNTRY

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        value={condition.field}
        onValueChange={(field) => {
          const nextField = field as SegmentConditionField
          onChange({
            field: nextField,
            operator: OPERATORS_BY_FIELD[nextField][0] ?? SegmentConditionOperator.EQUALS,
            value: nextField === SegmentConditionField.COUNTRY ? '' : condition.value,
          })
        }}
      >
        <SelectTrigger className="w-56">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.values(SegmentConditionField).map((field) => (
            <SelectItem key={field} value={field}>
              {t(`fields.${FIELD_KEYS[field]}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {isCountry ? (
        <p className="px-1 text-xs text-muted-foreground">{t('operators.equals')}</p>
      ) : (
        <Select
          value={condition.operator}
          onValueChange={(op) => onChange({ operator: op as SegmentConditionOperator })}
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {OPERATORS_BY_FIELD[condition.field].map((op) => (
              <SelectItem key={op} value={op}>
                {t(`operators.${OPERATOR_KEYS[op]}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {isCountry ? (
        <Select value={condition.value} onValueChange={(value) => onChange({ value })}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder={t('builder.placeholders.country')} />
          </SelectTrigger>
          <SelectContent>
            {countries.map((country) => (
              <SelectItem key={country} value={country}>
                {country}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <Input
          type="number"
          min={0}
          value={condition.value}
          onChange={(e) => onChange({ value: e.target.value })}
          placeholder={t(`builder.placeholders.${PLACEHOLDER_BY_FIELD[condition.field]}`)}
          className="w-44"
        />
      )}

      <Button
        variant="ghost"
        size="sm"
        className="text-muted-foreground hover:text-destructive"
        disabled={!canRemove}
        onClick={onRemove}
        aria-label={t('builder.removeCondition')}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  )
}
