import { useCallback, useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import type { CreateSegmentPayload, Segment, SegmentCondition } from '@/features/segments/types/segment.types'
import { SegmentConditionField, SegmentConditionOperator } from '@/features/segments/types/segment.types'
import { createSegment, previewSegment } from '@/features/segments/api/segmentsApi'
import { queryKeys } from '@/lib/query/queryKeys'

let conditionIdCounter = 0
const nextConditionId = (): string => `cond-${Date.now()}-${conditionIdCounter++}`

export interface DraftCondition {
  id: string
  field: SegmentConditionField
  operator: SegmentConditionOperator
  value: string
}

function makeDefaultCondition(): DraftCondition {
  return {
    id: nextConditionId(),
    field: SegmentConditionField.TOTAL_AMOUNT_SPENT,
    operator: SegmentConditionOperator.GREATER_THAN,
    value: '',
  }
}

/**
 * Segment builder state machine: conditions, live preview, save, reset.
 *
 * The draft is local component state — it is unsaved, unshared and never fetched —
 * while the preview is a debounced call and the save is a mutation that
 * invalidates the segments cache. Keeping the draft out of the query cache avoids
 * caching every keystroke.
 */
export function useSegmentBuilder(onCreated?: (segment: Segment) => void) {
  const { t } = useTranslation('segments')
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [conditions, setConditions] = useState<DraftCondition[]>([makeDefaultCondition()])
  const [matchCount, setMatchCount] = useState<number | null>(null)
  const [isPreviewing, setIsPreviewing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedName, setSavedName] = useState<string | null>(null)

  // Live preview: recompute the audience whenever conditions settle.
  useEffect(() => {
    const valid = conditions.every((c) => c.value.trim() !== '')
    if (!valid) {
      setMatchCount(null)
      setIsPreviewing(false)
      return
    }
    setIsPreviewing(true)
    let cancelled = false
    const timer = window.setTimeout(async () => {
      try {
        const count = await previewSegment(
          conditions.map((c) => ({ field: c.field, operator: c.operator, value: c.value })),
        )
        if (!cancelled) setMatchCount(count)
      } catch {
        if (!cancelled) setMatchCount(null)
      } finally {
        if (!cancelled) setIsPreviewing(false)
      }
    }, 350)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [conditions])

  const saveMutation = useMutation({
    mutationFn: (payload: CreateSegmentPayload) => createSegment(payload),
    onSuccess: async (segment) => {
      setSavedName(segment.name)
      setName('')
      setConditions([makeDefaultCondition()])
      setMatchCount(null)
      onCreated?.(segment)
      await queryClient.invalidateQueries({ queryKey: queryKeys.segments.all })
      window.setTimeout(() => setSavedName(null), 3_000)
    },
    onError: (cause) => {
      setError(cause instanceof Error ? cause.message : 'Failed to save segment')
    },
  })

  const addCondition = useCallback(() => {
    setConditions((prev) => [...prev, makeDefaultCondition()])
  }, [])

  const removeCondition = useCallback((id: string) => {
    setConditions((prev) => (prev.length > 1 ? prev.filter((c) => c.id !== id) : prev))
  }, [])

  const updateCondition = useCallback((id: string, patch: Partial<Omit<DraftCondition, 'id'>>) => {
    setConditions((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)))
  }, [])

  const isValid = name.trim().length > 0 && conditions.every((c) => c.value.trim() !== '')

  const save = useCallback(async (): Promise<Segment | null> => {
    if (!isValid) {
      setError(t('builder.validation'))
      return null
    }
    setError(null)
    return saveMutation.mutateAsync({
      name: name.trim(),
      conditions: conditions.map((c) => ({ field: c.field, operator: c.operator, value: c.value })),
    })
  }, [conditions, isValid, name, saveMutation, t])

  const reset = useCallback(() => {
    setName('')
    setConditions([makeDefaultCondition()])
    setMatchCount(null)
    setError(null)
  }, [])

  return {
    name,
    setName,
    conditions,
    matchCount,
    isPreviewing,
    isSaving: saveMutation.isPending,
    error,
    savedName,
    isValid,
    addCondition,
    removeCondition,
    updateCondition,
    save,
    reset,
  }
}

export type { SegmentCondition }
