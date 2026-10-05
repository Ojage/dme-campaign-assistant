import { useCallback, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { CampaignFormData, GeneratedCampaign } from '@/features/campaigns/types/campaign.types'
import { CampaignChannel, CampaignTone } from '@/features/campaigns/types/campaign.types'
import { generateCampaign, getCampaigns } from '@/features/campaigns/api/campaignsApi'
import { getSegments } from '@/features/segments/api/segmentsApi'
import { queryKeys } from '@/lib/query/queryKeys'

const EMPTY_FORM: CampaignFormData = {
  objective: '',
  segmentId: '',
  channel: CampaignChannel.SMS,
  tone: CampaignTone.FRIENDLY,
}

/**
 * Campaign composer: form state stays local, segments and history are queries.
 *
 * A generated campaign invalidates the campaigns cache instead of being pushed
 * into local state, so the list on the same screen and the one in the sidebar can
 * never disagree about what has been generated.
 */
export function useCampaignForm() {
  const queryClient = useQueryClient()
  const [form, setForm] = useState<CampaignFormData>(EMPTY_FORM)
  const [result, setResult] = useState<GeneratedCampaign | null>(null)

  const segmentsQuery = useQuery({ queryKey: queryKeys.segments.all, queryFn: getSegments })
  const campaignsQuery = useQuery({ queryKey: queryKeys.campaigns.all, queryFn: getCampaigns })

  const segments = segmentsQuery.data ?? []

  const generateMutation = useMutation({
    mutationFn: (payload: CampaignFormData) => generateCampaign(payload),
    onSuccess: async (campaign) => {
      setResult(campaign)
      await queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.all })
    },
  })

  const update = useCallback(<K extends keyof CampaignFormData>(key: K, value: CampaignFormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }, [])

  const generate = useCallback(async () => {
    if (!form.objective.trim() || !form.segmentId) return
    await generateMutation.mutateAsync(form)
  }, [form, generateMutation])

  // Preselect the first segment once, without stomping on a later choice.
  const [preselected, setPreselected] = useState(false)
  if (!preselected && segments.length > 0) {
    setPreselected(true)
    setForm((prev) => ({ ...prev, segmentId: prev.segmentId || (segments[0]?.id ?? '') }))
  }

  const loadError = [segmentsQuery.error, campaignsQuery.error].find((error) => error instanceof Error)

  return {
    form,
    segments,
    recent: campaignsQuery.data ?? ([] as GeneratedCampaign[]),
    result,
    isGenerating: generateMutation.isPending,
    error: generateMutation.error instanceof Error
      ? generateMutation.error.message
      : loadError instanceof Error
        ? loadError.message
        : null,
    update,
    generate,
    dismissResult: () => setResult(null),
  }
}
