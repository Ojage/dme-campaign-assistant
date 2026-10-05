import type { NewSegmentCondition, Segment } from '../../domain/segment.entity'

/** Driven port for saved segments. */
export interface SegmentRepository {
  list(): Promise<Segment[]>
  findById(id: string): Promise<Segment | null>
  create(segment: Segment): Promise<Segment>
  delete(id: string): Promise<boolean>
}

/**
 * Driven port for counting who a set of conditions reaches.
 *
 * The segments domain asks the question; the customers domain knows how to answer
 * it. Binding this port keeps the dependency pointing inwards.
 */
export interface AudienceCounter {
  countMatching(conditions: readonly NewSegmentCondition[]): Promise<number>
}

export const SEGMENT_PORTS = {
  repository: Symbol('SEGMENT.repository'),
  audienceCounter: Symbol('SEGMENT.audienceCounter'),
} as const