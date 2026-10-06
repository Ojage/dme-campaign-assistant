import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

/**
 * The record of one completed request that a client may repeat safely.
 *
 * The response body is stored rather than a resource id so a replay is answered
 * without touching the domain at all: the repeat is byte-for-byte what the first
 * attempt returned, which is the whole point of asking for an idempotency key.
 *
 * The unique index on `(scope, key)` decides which of two concurrent identical
 * requests owns the recorded response, so both callers converge on one answer.
 *
 * It does not stop the second request from also *running*: the row is written after
 * the handler completes, so a duplicate arriving mid-generation generates as well and
 * the two responses are reconciled afterwards. See `TypeOrmIdempotencyStore`.
 */
@Entity({ name: 'idempotency_records' })
@Index(['scope', 'key'], { unique: true })
@Index(['createdAt'])
export class IdempotencyRecordOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  public id!: string

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

  @Column({ type: 'int' })
  public statusCode!: number

  /**
   * Held as `object` rather than the precise `JsonValue` from the port: TypeORM
   * builds a recursive `DeepPartial` of this type, and feeding it a recursive alias
   * sends the compiler into an infinitely deep instantiation. The write side casts
   * from `JsonValue`, which is checked there.
   */
  @Column({ type: 'jsonb' })
  public body!: object

  /**
   * Age at which the record stops being replayed. Nothing prunes it yet, so records
   * accumulate for the lifetime of the table; the index is here so the purge lands in
   * one place when it does.
   */
  @CreateDateColumn({ type: 'timestamptz' })
  public createdAt!: Date
}