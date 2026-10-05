import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import type { Repository } from 'typeorm'
import type { CampaignRepository } from '../application/ports/campaign.ports'
import {
  Campaign,
  isCampaignChannel,
  isCampaignStatus,
  isCampaignTone,
} from '../domain/campaign.entity'
import type { CampaignStatus } from '../domain/campaign.entity'
import { CampaignOrmEntity } from '../../../shared/infrastructure/persistence/campaign.orm-entity'

function toDomain(row: CampaignOrmEntity): Campaign {
  return Campaign.reconstitute({
    id: row.id,
    title: row.title,
    message: row.message,
    callToAction: row.callToAction,
    segmentId: row.segmentId,
    segmentName: row.segmentName,
    channel: isCampaignChannel(row.channel) ? row.channel : 'sms',
    tone: isCampaignTone(row.tone) ? row.tone : 'professional',
    status: isCampaignStatus(row.status) ? row.status : 'draft',
    objective: row.objective,
    generatedAt: row.generatedAt,
  })
}

@Injectable()
export class TypeOrmCampaignRepository implements CampaignRepository {
  public constructor(
    @InjectRepository(CampaignOrmEntity) private readonly repository: Repository<CampaignOrmEntity>,
  ) {}

  public async list(): Promise<Campaign[]> {
    const rows = await this.repository.find({ order: { generatedAt: 'DESC' } })
    return rows.map(toDomain)
  }

  public async findById(id: string): Promise<Campaign | null> {
    const row = await this.repository.findOne({ where: { id } })
    return row === null ? null : toDomain(row)
  }

  public async save(campaign: Campaign): Promise<Campaign> {
    const row = new CampaignOrmEntity()
    row.title = campaign.title
    row.message = campaign.message
    row.callToAction = campaign.callToAction
    row.segmentId = campaign.segmentId
    row.segmentName = campaign.segmentName
    row.channel = campaign.channel
    row.tone = campaign.tone
    row.status = campaign.status
    row.objective = campaign.objective
    row.model = null
    return toDomain(await this.repository.save(row))
  }

  public async updateStatus(id: string, status: CampaignStatus): Promise<Campaign | null> {
    // `changeStatus` is the authority on legality, so load, ask, then persist.
    const campaign = await this.findById(id)
    if (campaign === null) return null
    campaign.changeStatus(status)
    await this.repository.update({ id }, { status })
    return campaign
  }

  public async delete(id: string): Promise<boolean> {
    const result = await this.repository.delete({ id })
    return (result.affected ?? 0) > 0
  }
}
