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

export function generateCampaign(payload: CampaignFormData): Promise<GeneratedCampaign> {
  return apiClient.call('campaigns.generate', {
    body: {
      objective: payload.objective.trim(),
      segmentId: payload.segmentId,
      channel: payload.channel,
      tone: payload.tone,
    },
  })
}

/** Lifecycle transitions are validated by the API; the UI only sends the target. */
export function updateCampaignStatus(id: string, status: 'draft' | 'ready' | 'sent'): Promise<GeneratedCampaign> {
  return apiClient.call('campaigns.updateStatus', { params: { id }, body: { status } })
}

export function deleteCampaign(id: string): Promise<null> {
  return apiClient.call('campaigns.delete', { params: { id } })
}
