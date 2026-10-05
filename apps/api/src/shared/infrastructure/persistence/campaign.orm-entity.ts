import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

/** Persistence model for a generated campaign. */
@Entity({ name: 'campaigns' })
@Index(['generatedAt'])
export class CampaignOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  public id!: string

  @Column({ type: 'varchar', length: 160 })
  public title!: string

  @Column({ type: 'text' })
  public message!: string

  @Column({ type: 'varchar', length: 120 })
  public callToAction!: string

  @Column({ type: 'uuid' })
  public segmentId!: string

  /** Kept for display so listing campaigns needs no join. */
  @Column({ type: 'varchar', length: 80 })
  public segmentName!: string

  @Column({ type: 'varchar', length: 16 })
  public channel!: string

  @Column({ type: 'varchar', length: 24 })
  public tone!: string

  @Column({ type: 'varchar', length: 16, default: 'ready' })
  public status!: string

  @Column({ type: 'text' })
  public objective!: string

  @Column({ type: 'varchar', length: 64, nullable: true })
  public model!: string | null

  @CreateDateColumn({ type: 'timestamptz' })
  public generatedAt!: Date
}
