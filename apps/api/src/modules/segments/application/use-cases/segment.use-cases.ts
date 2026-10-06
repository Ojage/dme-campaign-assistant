import { Inject, Injectable } from '@nestjs/common'
import { SEGMENT_PORTS } from '../ports/segment.ports'
import type { AudienceCounter, SegmentRepository } from '../ports/segment.ports'
import { Segment, SegmentSummary, type NewSegment, type NewSegmentCondition } from '../../domain/segment.entity'
import { NotFoundError } from '../../../../shared/domain/domain.errors'

@Injectable()
export class ListSegments {
  public constructor(@Inject(SEGMENT_PORTS.repository) private readonly segments: SegmentRepository) {}

  public execute(): Promise<Segment[]> {
    return this.segments.list()
  }
}

@Injectable()
export class GetSegmentSummary {
  public constructor(@Inject(SEGMENT_PORTS.repository) private readonly segments: SegmentRepository) {}

  public execute(): Promise<SegmentSummary> {
    return this.segments.summary()
  }
}

/**
 * Creating a segment counts its audience up front. The count is stored with the
 * segment so list views never have to run the matcher, and the creator sees the
 * size of what they just built.
 */
@Injectable()
export class CreateSegment {
  public constructor(
    @Inject(SEGMENT_PORTS.repository) private readonly segments: SegmentRepository,
    @Inject(SEGMENT_PORTS.audienceCounter) private readonly audience: AudienceCounter,
  ) {}

  public async execute(input: NewSegment): Promise<Segment> {
    const matchCount = await this.audience.countMatching(input.conditions)
    return this.segments.create(Segment.create(input, matchCount))
  }
}

@Injectable()
export class DeleteSegment {
  public constructor(@Inject(SEGMENT_PORTS.repository) private readonly segments: SegmentRepository) {}

  public async execute(id: string): Promise<void> {
    const deleted = await this.segments.delete(id)
    if (!deleted) throw new NotFoundError('That segment no longer exists.')
  }
}

/** Dry run used by the builder while the user is still editing conditions. */
@Injectable()
export class PreviewSegment {
  public constructor(@Inject(SEGMENT_PORTS.audienceCounter) private readonly audience: AudienceCounter) {}

  public execute(conditions: readonly NewSegmentCondition[]): Promise<{ matchCount: number }> {
    return this.audience.countMatching(conditions).then((matchCount) => ({ matchCount }))
  }
}