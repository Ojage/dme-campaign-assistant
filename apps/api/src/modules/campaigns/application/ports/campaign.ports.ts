import type { Campaign, CampaignStatus } from '../../domain/campaign.entity'
import type { NewSegmentCondition } from '../../../segments/domain/segment.entity'

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
  /** Stores unsaved conditions as a segment and returns its id and name. */
  persistConditions(conditions: readonly NewSegmentCondition[]): Promise<{ id: string; name: string }>
}

export const CAMPAIGN_PORTS = {
  repository: Symbol('CAMPAIGN.repository'),
  segmentResolver: Symbol('CAMPAIGN.segmentResolver'),
} as const