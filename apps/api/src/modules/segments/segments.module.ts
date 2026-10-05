import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { SEGMENT_PORTS } from './application/ports/segment.ports'
import {
  CreateSegment,
  DeleteSegment,
  ListSegments,
  PreviewSegment,
} from './application/use-cases/segment.use-cases'
import { TypeOrmAudienceCounter } from './infrastructure/typeorm-audience.counter'
import { TypeOrmSegmentRepository } from './infrastructure/typeorm-segment.repository'
import { SegmentsController } from './interface/http/segments.controller'
import { CustomerOrmEntity } from '../../shared/infrastructure/persistence/customer.orm-entity'
import { SegmentConditionOrmEntity } from '../../shared/infrastructure/persistence/segment-condition.orm-entity'
import { SegmentOrmEntity } from '../../shared/infrastructure/persistence/segment.orm-entity'

/** Composition root for the segments module. */
@Module({
  imports: [TypeOrmModule.forFeature([SegmentOrmEntity, SegmentConditionOrmEntity, CustomerOrmEntity])],
  controllers: [SegmentsController],
  providers: [
    ListSegments,
    CreateSegment,
    DeleteSegment,
    PreviewSegment,
    { provide: SEGMENT_PORTS.repository, useClass: TypeOrmSegmentRepository },
    { provide: SEGMENT_PORTS.audienceCounter, useClass: TypeOrmAudienceCounter },
  ],
  exports: [SEGMENT_PORTS.repository, SEGMENT_PORTS.audienceCounter],
})
export class SegmentsModule {}
