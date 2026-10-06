import { randomUUID } from 'node:crypto'
import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import type { Repository } from 'typeorm'
import type {
  IdempotencyStore,
  IdempotentResponse,
  JsonValue,
  RememberedResponse,
} from '../../application/ports/idempotency-store.port'
import { IdempotencyRecordOrmEntity } from './idempotency-record.orm-entity'

function toResponse(row: IdempotencyRecordOrmEntity): IdempotentResponse {
  return { fingerprint: row.fingerprint, statusCode: row.statusCode, body: row.body as JsonValue }
}

/**
 * TypeORM implementation of the idempotency store.
 *
 * The unique index on `(scope, key)` is the arbiter when two identical requests race:
 * the insert is a no-op for the loser, which then reads back the row that won so both
 * callers are eventually given the same answer.
 *
 * Note what this does *not* prevent: the row is written after the handler has already
 * run, so a duplicate that arrives while the first request is still generating still
 * generates. Converging the responses is what the unique index buys; converging the
 * work needs the record claimed before the handler runs.
 */
@Injectable()
export class TypeOrmIdempotencyStore implements IdempotencyStore {
  public constructor(
    @InjectRepository(IdempotencyRecordOrmEntity)
    private readonly repository: Repository<IdempotencyRecordOrmEntity>,
  ) {}

  public async find(scope: string, key: string): Promise<IdempotentResponse | null> {
    const row = await this.repository.findOne({ where: { scope, key } })
    return row === null ? null : toResponse(row)
  }

  public async remember(
    scope: string,
    key: string,
    response: IdempotentResponse,
  ): Promise<RememberedResponse> {
    // The id is chosen here rather than left to the column default, so the read-back
    // can tell "my row" from "the winner's row" by comparing it.
    const attempted = this.repository.create({
      id: randomUUID(),
      scope,
      key,
      fingerprint: response.fingerprint,
      statusCode: response.statusCode,
      body: response.body as object,
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
    // A null here would mean the insert was skipped for some reason other than a
    // duplicate, so treating this caller as the winner is the safe answer.
    if (stored === null) return { response, inserted: true }
    return { response: toResponse(stored), inserted: stored.id === attempted.id }
  }
}