import { useCallback, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError } from '@dme/contracts/http'
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
 * How long to wait before retrying a failed generation, and how many times.
 *
 * The wait grows because a 503 means the model provider is struggling, and an
 * immediate repeat adds load exactly when there is least headroom for it. The upper
 * half of each window is discarded so a fleet of open tabs does not resynchronise.
 *
 * The first attempt is made here; the API is separately retrying the model call
 * underneath, which is why this count stays small.
 */
const GENERATE_RETRY_BASE_DELAY_MS = 1_000
const GENERATE_RETRY_ATTEMPTS = 3

/** Which failures are worth repeating at all. */
function isWorthRetrying(failureCount: number, error: unknown): boolean {
  if (failureCount >= GENERATE_RETRY_ATTEMPTS) return false
  // A rejected request stays rejected: repeating it cannot turn a 4xx into a draft.
  // This also excludes the 409 a client gets by reusing one idempotency key for two
  // different requests, which retrying would only repeat.
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false
  return true
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
  // Id of the campaign that just came out of a generation. Unlike `result`, it is
  // cleared again when the user opens an older campaign from history, so the page
  // can tell "freshly generated" apart from "reopened" and confetti only fires once.
  const [celebrateId, setCelebrateId] = useState<string | null>(null)

  const segmentsQuery = useQuery({ queryKey: queryKeys.segments.all, queryFn: getSegments })
  const campaignsQuery = useQuery({
    queryKey: queryKeys.campaigns.all,
    queryFn: () => getCampaigns(),
  })
  const segments = segmentsQuery.data ?? []
  const recent = campaignsQuery.data?.items ?? []

  /**
   * One submit and its retries are one logical request, so the key travels with the
   * variables rather than being read from somewhere mutable: a retry then cannot
   * pick up a different key even if the user starts another submit meanwhile.
   */
  const generateMutation = useMutation({
    mutationFn: ({ form, idempotencyKey }: { form: CampaignFormData; idempotencyKey: string }) =>
      generateCampaign(form, idempotencyKey),
    // Safe because the request carries an idempotency key: the API records the first
    // success and replays it, so a retry after a timeout returns the campaign that
    // was already created instead of generating a second one.
    retry: isWorthRetrying,
    retryDelay: (attempt) => {
      const ceiling = GENERATE_RETRY_BASE_DELAY_MS * 2 ** attempt
      return GENERATE_RETRY_BASE_DELAY_MS + Math.random() * (ceiling - GENERATE_RETRY_BASE_DELAY_MS)
    },
    onSuccess: async (campaign) => {
      setResult(campaign)
      setCelebrateId(campaign.id)
      await queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.all })
    },
  })

  const update = useCallback(<K extends keyof CampaignFormData>(key: K, value: CampaignFormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }, [])

  const generate = useCallback(async () => {
    if (!form.objective.trim() || !form.segmentId) return
    // Minted per submit rather than inside the api function, so every retry of this
    // submit sends the same one and the API recognises the repeat.
    await generateMutation.mutateAsync({ form, idempotencyKey: crypto.randomUUID() })
  }, [form, generateMutation])

  const openCampaign = useCallback((campaign: GeneratedCampaign) => {
    setResult(campaign)
    // A reopen is not a celebration: clear the burst marker so the page does not
    // throw confetti every time an old campaign is pulled up again.
    setCelebrateId(null)
  }, [])

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
    recent,
    result,
    isGenerating: generateMutation.isPending,
    error: generateMutation.error instanceof Error
      ? generateMutation.error.message
      : loadError instanceof Error
        ? loadError.message
        : null,
    update,
    generate,
    // Reopening an older campaign shows it in the same preview pane. It uses the
    // exact same shape as a fresh result, so future reads only ever see one format.
    openCampaign,
    dismissResult: () => setResult(null),
    celebrateId,
  }
}
