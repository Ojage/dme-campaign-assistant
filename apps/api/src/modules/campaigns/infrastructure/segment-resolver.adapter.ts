import { Inject, Injectable } from '@nestjs/common'
import type { SegmentResolver } from '../application/ports/campaign.ports'
import { SEGMENT_PORTS } from '../../segments/application/ports/segment.ports'
import type { AudienceCounter, SegmentRepository } from '../../segments/application/ports/segment.ports'
import { Segment } from '../../segments/domain/segment.entity'
import type { NewSegmentCondition } from '../../segments/domain/segment.entity'

/**
 * Bridges the campaigns module to the segments one.
 *
 * It reuses the segment repository and audience counter through their ports, so
 * the mapping from condition rows to domain conditions is written once in the
 * segments adapter rather than copied here.
 */
@Injectable()
export class SegmentResolverAdapter implements SegmentResolver {
  public constructor(
    @Inject(SEGMENT_PORTS.repository) private readonly segments: SegmentRepository,
    @Inject(SEGMENT_PORTS.audienceCounter) private readonly audience: AudienceCounter,
  ) {}

  public async resolveName(segmentId: string): Promise<string | null> {
    const segment = await this.segments.findById(segmentId)
    return segment === null ? null : segment.name
  }

  /** Ad-hoc conditions become a real, named segment so the campaign can reference it. */
  public async persistConditions(conditions: readonly NewSegmentCondition[]): Promise<{ id: string; name: string }> {
    const matchCount = await this.audience.countMatching(conditions)
    const summary = conditions
      .map((condition) => `${condition.field} ${condition.operator} ${String(condition.value)}`)
      .join(' and ')
      .slice(0, 80)

    const segment = await this.segments.create(Segment.create({ name: summary, conditions }, matchCount))
    return { id: segment.id, name: segment.name }
  }
}