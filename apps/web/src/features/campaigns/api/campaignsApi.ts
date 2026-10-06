/**
 * Campaigns API — live calls through the shared client.
 *
 * Generation happens server-side against the Anthropic port, so the browser never
 * sees a model SDK and the segment name is not sent: the API resolves it from the
 * segment id, which is the only source of truth for that name.
 */

import { apiClient } from '@/lib/api/apiClient'
import type { CampaignFormData, GeneratedCampaign } from '@/features/campaigns/types/campaign.types'

export function getCampaigns(): Promise<GeneratedCampaign[]> {
  return apiClient.call('campaigns.list')
}

/**
 * `idempotencyKey` identifies one *logical* request, so it is minted once per submit
 * and reused by every retry of that submit. It is required rather than defaulted
 * because a fresh key per attempt would make the API treat each retry as a distinct
 * request — and the retry would create a second campaign, which is the one thing
 * sending the key is meant to prevent.
 */
export function generateCampaign(payload: CampaignFormData, idempotencyKey: string): Promise<GeneratedCampaign> {
  return apiClient.call('campaigns.generate', {
    body: {
      objective: payload.objective.trim(),
      segmentId: payload.segmentId,
      channel: payload.channel,
      tone: payload.tone,
    },
    idempotencyKey,
  })
}

/** Lifecycle transitions are validated by the API; the UI only sends the target. */
export function updateCampaignStatus(id: string, status: 'draft' | 'ready' | 'sent'): Promise<GeneratedCampaign> {
  return apiClient.call('campaigns.updateStatus', { params: { id }, body: { status } })
}

export function deleteCampaign(id: string): Promise<null> {
  return apiClient.call('campaigns.delete', { params: { id } })
}
