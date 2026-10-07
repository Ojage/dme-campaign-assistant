import { randomUUID } from 'node:crypto'
import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { LessThan, Repository } from 'typeorm'
import type {
  IdempotencyClaim,
  IdempotencyStatus,
  IdempotencyStore,
  IdempotentResponse,
} from '../../application/ports/idempotency-store.port'
import { IdempotencyRecordOrmEntity } from './idempotency-record.orm-entity'

function toResponse(row: IdempotencyRecordOrmEntity): IdempotentResponse {
  return {
    fingerprint: row.fingerprint,
    statusCode: row.statusCode as number,
    body: row.body as IdempotentResponse['body'],
  }
}

/**
 * TypeORM implementation of the idempotency store.
 *
 * The unique index on `(scope, key)` is the arbiter when two identical requests
 * race. The loser's insert is a no-op, so the loser reads back the winner's row
 * and can either replay a finished answer or wait for a processing one — the
 * second request never runs the side effect a second time.
 */
@Injectable()
export class TypeOrmIdempotencyStore implements IdempotencyStore {
  public constructor(
    @InjectRepository(IdempotencyRecordOrmEntity)
    private readonly repository: Repository<IdempotencyRecordOrmEntity>,
  ) {}

  public async find(scope: string, key: string): Promise<IdempotentResponse | null> {
    const row = await this.repository.findOne({ where: { scope, key, status: 'completed' } })
    return row === null ? null : toResponse(row)
  }

  public async claim(scope: string, key: string, fingerprint: string): Promise<IdempotencyClaim> {
    // The id is chosen here rather than left to the column default, so the read-back
    // can tell "my row" from the winner's row by comparing it.
    const attempted = this.repository.create({
      id: randomUUID(),
      scope,
      key,
      fingerprint,
      status: 'processing',
      statusCode: null,
      body: null,
    })

    // `orIgnore` turns the duplicate into a no-op instead of an error, because a key
    // that is already taken is a normal outcome of two clients racing.
    await this.repository
      .createQueryBuilder()
      .insert()
      .into(IdempotencyRecordOrmEntity)
      .values(attempted)
      .orIgnore()
      .execute()

    const stored = await this.repository.findOne({ where: { scope, key } })
    // A null here means the insert was skipped for some reason other than a
    // duplicate, so treating this caller as the winner is the safe answer.
    if (stored === null) {
      return { owner: true, completed: null, processingSince: null, id: attempted.id }
    }

    const owned = stored.id === attempted.id
    if (stored.status === 'processing') {
      return { owner: owned, completed: null, processingSince: stored.createdAt, id: owned ? stored.id : null }
    }
    // A completed row can never be owned by a fresh claimant. Reachable when the
    // winner finished between the insert and this read-back.
    return { owner: false, completed: toResponse(stored), processingSince: null, id: null }
  }

  public async statusOf(scope: string, key: string): Promise<IdempotencyStatus> {
    const row = await this.repository.findOne({ where: { scope, key } })
    if (row === null) return { state: 'absent' }
    if (row.status === 'processing') {
      return { state: 'processing', fingerprint: row.fingerprint, processingSince: row.createdAt }
    }
    return { state: 'completed', response: toResponse(row) }
  }

  public async complete(
    scope: string,
    key: string,
    id: string,
    response: IdempotentResponse,
  ): Promise<void> {
    // The claim guard (`status: 'processing'`) means a completed row can never be
    // overwritten, including by the ghost of a request whose claim was taken over.
    await this.repository.update(
      { id, scope, key, status: 'processing' },
      { status: 'completed', statusCode: response.statusCode, body: response.body as object },
    )
  }

  public async release(scope: string, key: string, id?: string): Promise<void> {
    await this.repository.delete({ scope, key, status: 'processing', ...(id === undefined ? {} : { id }) })
  }

  public async prune(now: Date, retentionMs: number): Promise<number> {
    const cutoff = new Date(now.getTime() - retentionMs)
    const result = await this.repository.delete({ status: 'completed', createdAt: LessThan(cutoff) })
    return result.affected ?? 0
  }
}