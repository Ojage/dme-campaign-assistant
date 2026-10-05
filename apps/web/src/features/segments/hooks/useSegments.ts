import { useCallback, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Segment } from '@/features/segments/types/segment.types'
import { deleteSegment as deleteSegmentRequest, getSegments } from '@/features/segments/api/segmentsApi'
import { queryKeys } from '@/lib/query/queryKeys'

/**
 * Saved segments, read from the query cache.
 *
 * Deletion is a mutation that invalidates the list rather than splicing local
 * state, so the campaigns page — which reads the same key — cannot end up
 * offering a segment that no longer exists.
 */
export function useSegments() {
  const queryClient = useQueryClient()
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const query = useQuery({
    queryKey: queryKeys.segments.all,
    queryFn: getSegments,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteSegmentRequest(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.segments.all }),
  })

  const deleteSegment = useCallback(
    async (id: string) => {
      setDeletingId(id)
      try {
        await deleteMutation.mutateAsync(id)
      } finally {
        setDeletingId(null)
      }
    },
    [deleteMutation],
  )

  const reload = useCallback(() => void query.refetch(), [query])

  return {
    segments: query.data ?? ([] as Segment[]),
    isLoading: query.isPending,
    error: query.error instanceof Error ? query.error.message : null,
    deletingId,
    reload,
    deleteSegment,
    /** Used by the builder so a new segment shows up without a refetch delay. */
    addSegment: () => queryClient.invalidateQueries({ queryKey: queryKeys.segments.all }),
  }
}
