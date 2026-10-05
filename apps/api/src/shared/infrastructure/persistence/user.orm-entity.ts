import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

/**
 * Persistence model for a workspace user. This is deliberately separate from the
 * `User` domain entity: the ORM shape is an adapter concern and may carry columns
 * the domain has no use for.
 */
@Entity({ name: 'users' })
export class UserOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  public id!: string

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 320 })
  public email!: string

  @Column({ type: 'varchar', length: 160 })
  public fullName!: string

  @Column({ type: 'varchar', length: 32, default: 'lifecycle_marketer' })
  public role!: string

  /** Argon2/bcrypt hash — never the raw password. */
  @Column({ type: 'varchar', length: 120 })
  public passwordHash!: string

  @Column({ type: 'boolean', default: true })
  public isActive!: boolean

  @Column({ type: 'timestamptz', default: () => 'now()' })
  public createdAt!: Date

  @Column({ type: 'timestamptz', default: () => 'now()' })
  public updatedAt!: Date
}