import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { IsNull, LessThan, Repository } from 'typeorm'
import type { SessionRepository, StoredSession } from '../application/ports/auth.ports'
import { SessionOrmEntity } from '../../../shared/infrastructure/persistence/session.orm-entity'

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
      userAgent: input.userAgent,
      revokedAt: null,
    })
    return toStored(await this.repository.save(row))
  }

  public async findActiveByTokenHash(tokenHash: string): Promise<StoredSession | null> {
    const row = await this.repository.findOne({ where: { tokenHash, revokedAt: IsNull() } })
    return row === null ? null : toStored(row)
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
