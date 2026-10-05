import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm'
import { SegmentOrmEntity } from './segment.orm-entity'

/**
 * A single clause of a segment. `value` is stored as text because the same column
 * carries both numeric thresholds and country names; the domain entity types it
 * correctly on the way out.
 */
@Entity({ name: 'segment_conditions' })
export class SegmentConditionOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  public id!: string

  @ManyToOne(() => SegmentOrmEntity, (segment) => segment.conditions, { onDelete: 'CASCADE' })
  public segment?: SegmentOrmEntity

  @Column({ type: 'varchar', length: 32 })
  public field!: string

  @Column({ type: 'varchar', length: 8 })
  public operator!: string

  @Column({ type: 'varchar', length: 160 })
  public value!: string
}
