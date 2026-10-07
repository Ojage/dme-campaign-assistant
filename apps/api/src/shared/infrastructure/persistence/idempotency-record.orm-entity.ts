import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

/**
 * The record of one request that a client may repeat safely.
 *
 * The row exists in two states. While the first request is still running it sits
 * as a `processing` placeholder, which is what stops a concurrent duplicate from
 * running a second time: the duplicate sees the claim and waits instead of
 * repeating the side effect. When the owner finishes, the row turns `completed`
 * and carries the response body, so a replay is answered byte-for-byte without
 * touching the domain at all.
 *
 * The unique index on `(scope, key)` decides which of two concurrent claims owns
 * the key; the owner is the one whose inserted row the winner kept.
 */
@Entity({ name: 'idempotency_records' })
@Index(['scope', 'key'], { unique: true })
@Index(['createdAt'])
export class IdempotencyRecordOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  public id!: string

  /** `processing` while the first request is running, `completed` once recorded. */
  @Column({ type: 'varchar', length: 16, default: 'completed' })
  public status!: 'processing' | 'completed'

  /**
   * Who the key belongs to. Scoping to the caller is what stops one workspace
   * member from replaying another's key and reading their response.
   */
  @Column({ type: 'uuid' })
  public scope!: string

  @Column({ type: 'varchar', length: 255 })
  public key!: string

  /** Digest of method, path and body, to catch a key reused for a different request. */
  @Column({ type: 'varchar', length: 64 })
  public fingerprint!: string

  /** Null while `processing`; set when the owner records its response. */
  @Column({ type: 'int', nullable: true })
  public statusCode!: number | null

  /**
   * Held as `object` rather than the precise `JsonValue` from the port: TypeORM
   * builds a recursive `DeepPartial` of this type, and feeding it a recursive alias
   * sends the compiler into an infinitely deep instantiation. The write side casts
   * from `JsonValue`, which is checked there. Null while `processing`.
   */
  @Column({ type: 'jsonb', nullable: true })
  public body!: object | null

  /**
   * Age at which a completed record stops being replayed. `prune` deletes rows
   * older than this on idempotent traffic; the index exists so the purge lands in
   * one place.
   */
  @CreateDateColumn({ type: 'timestamptz' })
  public createdAt!: Date
}