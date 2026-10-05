import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

/** Persistence model for a customer record. */
@Entity({ name: 'customers' })
@Index(['email'], { unique: true })
@Index(['status'])
@Index(['lastActivityDate'])
export class CustomerOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  public id!: string

  @Column({ type: 'varchar', length: 160 })
  public name!: string

  @Column({ type: 'varchar', length: 320 })
  public email!: string

  @Column({ type: 'varchar', length: 80 })
  public country!: string

  @Column({ type: 'int', default: 0 })
  public totalTransactions!: number

  /** Numeric rather than float so aggregated spend never drifts. */
  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  public totalAmountSpent!: string

  @Column({ type: 'timestamptz' })
  public lastActivityDate!: Date

  @Column({ type: 'varchar', length: 16, default: 'active' })
  public status!: string

  @CreateDateColumn({ type: 'timestamptz' })
  public createdAt!: Date
}
