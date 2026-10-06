/**
 * Segments API — live calls through the shared client.
 *
 * The UI edits condition values as strings while they are being typed; the
 * contract requires a number for numeric fields and a string for `country`. That
 * conversion is the only real work in this layer.
 */

import type { CreateSegmentRequest } from '@dme/contracts'
import { apiClient } from '@/lib/api/apiClient'
import type {
  CreateSegmentPayload,
  Segment,
  SegmentSummary,
} from '@/features/segments/types/segment.types'
import { SegmentConditionField } from '@/features/segments/types/segment.types'

type DraftCondition = CreateSegmentPayload['conditions'][number]

export function getSegments(): Promise<Segment[]> {
  return apiClient.call('segments.list')
}

/** Aggregate reach of the saved segments, shown on the dashboard. */
export function getSegmentSummary(): Promise<SegmentSummary> {
  return apiClient.call('segments.summary')
}

export function createSegment(payload: CreateSegmentPayload): Promise<Segment> {
  return apiClient.call('segments.create', {
    body: { name: payload.name.trim(), conditions: payload.conditions.map(toContractCondition) },
  })
}

export function deleteSegment(id: string): Promise<null> {
  return apiClient.call('segments.delete', { params: { id } })
}

/** Live audience size for the conditions currently in the builder. */
export async function previewSegment(conditions: DraftCondition[]): Promise<number> {
  const result = await apiClient.call('segments.preview', {
    body: { conditions: conditions.map(toContractCondition) },
  })
  return result.matchCount
}

/**
 * Narrows a loosely-typed builder condition to the contract's discriminated union:
 * a country compares text, the other three compare numbers.
 *
 * The builder only offers equality for a country (see ConditionRow), and the
 * contract requires it, so the literal is asserted rather than the wider operator.
 */
function toContractCondition(condition: DraftCondition): CreateSegmentRequest['conditions'][number] {
  if (condition.field === SegmentConditionField.COUNTRY) {
    return { field: 'country', operator: 'eq', value: String(condition.value).trim() }
  }
  return {
    field: condition.field,
    operator: condition.operator,
    // The builder holds text; a non-numeric threshold is rejected by the contract
    // and surfaces as a validation error rather than a silently ignored clause.
    value: Number(condition.value),
  }
}
