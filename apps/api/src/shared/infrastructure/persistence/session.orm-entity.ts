import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm'
import { UserOrmEntity } from './user.orm-entity'

/**
 * A refresh-token session. Storing the hash rather than the token means a leaked
 * database cannot be replayed against the API, and revoking a row signs a device
 * out immediately.
 */
@Entity({ name: 'sessions' })
@Index(['tokenHash'], { unique: true })
@Index(['userId'])
export class SessionOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  public id!: string

  @Column({ type: 'uuid' })
  public userId!: string

  @ManyToOne(() => UserOrmEntity, { onDelete: 'CASCADE' })
  public user?: UserOrmEntity

  @Column({ type: 'varchar', length: 128 })
  public tokenHash!: string

  @Column({ type: 'timestamptz' })
  public expiresAt!: Date

  @Column({ type: 'timestamptz', nullable: true })
  public revokedAt!: Date | null

  @Column({ type: 'varchar', length: 64, nullable: true })
  public userAgent!: string | null

  @CreateDateColumn({ type: 'timestamptz' })
  public createdAt!: Date

  @UpdateDateColumn({ type: 'timestamptz' })
  public updatedAt!: Date
}