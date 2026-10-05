import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm'
import { SegmentConditionOrmEntity } from './segment-condition.orm-entity'

/** Persistence model for a saved audience segment. */
@Entity({ name: 'segments' })
export class SegmentOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  public id!: string

  @Column({ type: 'varchar', length: 80 })
  public name!: string

  @OneToMany(() => SegmentConditionOrmEntity, (condition) => condition.segment, {
    cascade: true,
    eager: true,
  })
  public conditions!: SegmentConditionOrmEntity[]

  /** Denormalised count so list views never have to run the matcher. */
  @Column({ type: 'int', default: 0 })
  public matchCount!: number

  @CreateDateColumn({ type: 'timestamptz' })
  public createdAt!: Date
}
