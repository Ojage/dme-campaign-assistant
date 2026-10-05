import type { CampaignChannel as ContractChannel, CampaignTone as ContractTone } from '@dme/contracts'

/** Const objects, not enums, so the values are the contract's own unions. */
export const CampaignChannel = {
  SMS: 'sms',
  EMAIL: 'email',
  PUSH: 'push',
} as const satisfies Record<string, ContractChannel>

export type CampaignChannel = ContractChannel

export const CampaignTone = {
  PROFESSIONAL: 'professional',
  FRIENDLY: 'friendly',
  URGENT: 'urgent',
  PROMOTIONAL: 'promotional',
} as const satisfies Record<string, ContractTone>

export type CampaignTone = ContractTone

export interface CampaignFormData {
  objective: string
  segmentId: string
  channel: CampaignChannel
  tone: CampaignTone
}

export interface GeneratedCampaign {
  id: string
  title: string
  message: string
  callToAction: string
  segmentName: string
  channel: CampaignChannel
  tone: CampaignTone
  status: 'draft' | 'ready' | 'sent'
  objective: string
  generatedAt: string
}

export type CreateCampaignPayload = CampaignFormData
