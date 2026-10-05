import type { Campaign, CampaignStatus } from '../../domain/campaign.entity'

export interface CampaignRepository {
  list(): Promise<Campaign[]>
  findById(id: string): Promise<Campaign | null>
  save(campaign: Campaign): Promise<Campaign>
  updateStatus(id: string, status: CampaignStatus): Promise<Campaign | null>
  delete(id: string): Promise<boolean>
}

/** Resolves the segment a campaign targets; hides how segments are stored. */
export interface SegmentResolver {
  /** Returns the segment's display name, or null when the id is unknown. */
  resolveName(segmentId: string): Promise<string | null>
}

export const CAMPAIGN_PORTS = {
  repository: Symbol('CAMPAIGN.repository'),
  segmentResolver: Symbol('CAMPAIGN.segmentResolver'),
} as const