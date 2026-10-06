import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { SEARCH_PORTS } from './application/ports/search.ports'
import { SearchGlobal } from './application/use-cases/search.use-cases'
import { TypeOrmSearchRepository } from './infrastructure/typeorm-search.repository'
import { SearchController } from './interface/http/search.controller'
import { CustomerOrmEntity } from '../../shared/infrastructure/persistence/customer.orm-entity'
import { SegmentOrmEntity } from '../../shared/infrastructure/persistence/segment.orm-entity'
import { CampaignOrmEntity } from '../../shared/infrastructure/persistence/campaign.orm-entity'

/** Composition root for global search. */
@Module({
  imports: [TypeOrmModule.forFeature([CustomerOrmEntity, SegmentOrmEntity, CampaignOrmEntity])],
  controllers: [SearchController],
  providers: [SearchGlobal, { provide: SEARCH_PORTS.repository, useClass: TypeOrmSearchRepository }],
})
export class SearchModule {}