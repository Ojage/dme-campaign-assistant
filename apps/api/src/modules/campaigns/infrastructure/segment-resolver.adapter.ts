import { Inject, Injectable } from '@nestjs/common'
import type { SegmentResolver } from '../application/ports/campaign.ports'
import { SEGMENT_PORTS } from '../../segments/application/ports/segment.ports'
import type { SegmentRepository } from '../../segments/application/ports/segment.ports'

/**
 * Bridges the campaigns module to the segments one.
 *
 * A campaign only needs the name of the segment it targets, so the campaigns
 * module depends on this narrow port instead of the whole segments repository.
 */
@Injectable()
export class SegmentResolverAdapter implements SegmentResolver {
  public constructor(@Inject(SEGMENT_PORTS.repository) private readonly segments: SegmentRepository) {}

  public async resolveName(segmentId: string): Promise<string | null> {
    const segment = await this.segments.findById(segmentId)
    return segment === null ? null : segment.name
  }
}