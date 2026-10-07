import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { IsNull, LessThan, Repository } from 'typeorm'
import type { SessionRepository, StoredSession } from '../application/ports/auth.ports'
import { SessionOrmEntity } from '../../../shared/infrastructure/persistence/session.orm-entity'

/** Matches the `userAgent` column width. */
const MAX_USER_AGENT_LENGTH = 256

function toStored(row: SessionOrmEntity): StoredSession {
  return {
    id: row.id,
    userId: row.userId,
    tokenHash: row.tokenHash,
    expiresAt: row.expiresAt,
    revokedAt: row.revokedAt,
  }
}

/** TypeORM adapter for refresh-token sessions. */
@Injectable()
export class TypeOrmSessionRepository implements SessionRepository {
  public constructor(
    @InjectRepository(SessionOrmEntity) private readonly repository: Repository<SessionOrmEntity>,
  ) {}

  public async create(input: {
    userId: string
    tokenHash: string
    expiresAt: Date
    userAgent: string | null
  }): Promise<StoredSession> {
    const row = this.repository.create({
      userId: input.userId,
      tokenHash: input.tokenHash,
      expiresAt: input.expiresAt,
      // A `User-Agent` header is client-supplied and unbounded, so it is truncated
      // here rather than trusted to fit. Sign-in must not fail because a browser
      // sent a long string.
      userAgent: input.userAgent === null ? null : input.userAgent.slice(0, MAX_USER_AGENT_LENGTH),
      revokedAt: null,
    })
    return toStored(await this.repository.save(row))
  }

  public async findActiveByTokenHash(tokenHash: string): Promise<StoredSession | null> {
    const row = await this.repository.findOne({ where: { tokenHash, revokedAt: IsNull() } })
    return row === null ? null : toStored(row)
  }

  public async consume(tokenHash: string): Promise<{ sessionId: string; userId: string } | null> {
    // A single conditional UPDATE, so the row is claimed and revoked in one atomic
    // step: exactly one concurrent refresh presenting this hash can win it.
    const result = await this.repository
      .createQueryBuilder()
      .update(SessionOrmEntity)
      .set({ revokedAt: new Date() })
      .where('token_hash = :tokenHash AND revoked_at IS NULL AND expires_at > :now', {
        tokenHash,
        now: new Date(),
      })
      .returning(['id', 'user_id'])
      .execute()

    const raw = result.raw as Array<{ id: string; user_id: string }> | undefined
    const row = raw?.[0]
    return row === undefined ? null : { sessionId: row.id, userId: row.user_id }
  }

  public async revoke(id: string): Promise<void> {
    await this.repository.update({ id }, { revokedAt: new Date() })
  }

  public async revokeAllForUser(userId: string): Promise<void> {
    await this.repository.update({ userId, revokedAt: IsNull() }, { revokedAt: new Date() })
  }

  public async deleteExpired(now: Date): Promise<number> {
    const result = await this.repository.delete({ expiresAt: LessThan(now) })
    return result.affected ?? 0
  }
}
