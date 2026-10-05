import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { CAMPAIGN_PORTS } from './application/ports/campaign.ports'
import {
  DeleteCampaign,
  GenerateCampaign,
  ListCampaigns,
  UpdateCampaignStatus,
} from './application/use-cases/campaign.use-cases'
import { TypeOrmCampaignRepository } from './infrastructure/typeorm-campaign.repository'
import { SegmentResolverAdapter } from './infrastructure/segment-resolver.adapter'
import { CampaignsController } from './interface/http/campaigns.controller'
import { SegmentsModule } from '../segments/segments.module'
import { LlmModule } from '../../shared/infrastructure/llm/llm.module'
import { CampaignOrmEntity } from '../../shared/infrastructure/persistence/campaign.orm-entity'

/** Composition root for the campaigns module. */
@Module({
  imports: [TypeOrmModule.forFeature([CampaignOrmEntity]), SegmentsModule, LlmModule],
  controllers: [CampaignsController],
  providers: [
    ListCampaigns,
    GenerateCampaign,
    UpdateCampaignStatus,
    DeleteCampaign,
    { provide: CAMPAIGN_PORTS.repository, useClass: TypeOrmCampaignRepository },
    { provide: CAMPAIGN_PORTS.segmentResolver, useClass: SegmentResolverAdapter },
  ],
})
export class CampaignsModule {}
