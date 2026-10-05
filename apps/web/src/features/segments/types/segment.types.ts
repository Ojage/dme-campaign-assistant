import type {
  SegmentField as ContractField,
  SegmentOperator as ContractOperator,
} from '@dme/contracts'

/** Const objects, not enums, so the values are the contract's own unions. */
export const SegmentConditionField = {
  TOTAL_AMOUNT_SPENT: 'totalAmountSpent',
  TOTAL_TRANSACTIONS: 'totalTransactions',
  LAST_ACTIVITY_DAYS: 'lastActivityDays',
  COUNTRY: 'country',
} as const satisfies Record<string, ContractField>

export type SegmentConditionField = ContractField

export const SegmentConditionOperator = {
  GREATER_THAN: 'gt',
  LESS_THAN: 'lt',
  EQUALS: 'eq',
} as const satisfies Record<string, ContractOperator>

export type SegmentConditionOperator = ContractOperator

export interface SegmentCondition {
  id: string
  field: SegmentConditionField
  operator: SegmentConditionOperator
  value: string | number
}

export interface Segment {
  id: string
  name: string
  conditions: SegmentCondition[]
  matchCount: number
  createdAt: string
}

/**
 * Conditions as the builder holds them: no ids yet, values still text. The API
 * layer converts this into the contract's discriminated union.
 */
export interface CreateSegmentPayload {
  name: string
  conditions: Array<{ field: SegmentConditionField; operator: SegmentConditionOperator; value: string | number }>
}
