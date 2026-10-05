import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { isUserRole, User } from '../domain/user.entity'
import type { CredentialsRecord, UserRepository } from '../application/ports/auth.ports'
import { UserOrmEntity } from '../../../shared/infrastructure/persistence/user.orm-entity'

/** Maps the persistence model onto the domain entity. */
function toDomain(row: UserOrmEntity): User {
  return new User(
    row.id,
    row.email,
    row.fullName,
    isUserRole(row.role) ? row.role : 'lifecycle_marketer',
    row.isActive,
    row.createdAt,
  )
}

/**
 * TypeORM adapter for the user port. The rest of the application never sees an ORM
 * entity, so swapping Postgres for another store touches only this file.
 */
@Injectable()
export class TypeOrmUserRepository implements UserRepository {
  public constructor(
    @InjectRepository(UserOrmEntity) private readonly repository: Repository<UserOrmEntity>,
  ) {}

  public async findCredentialsByEmail(email: string): Promise<CredentialsRecord | null> {
    const row = await this.repository.findOne({ where: { email: email.trim().toLowerCase() } })
    if (row === null) return null
    return { user: toDomain(row), passwordHash: row.passwordHash }
  }

  public async findById(id: string): Promise<User | null> {
    const row = await this.repository.findOne({ where: { id } })
    return row === null ? null : toDomain(row)
  }

  public async existsByEmail(email: string): Promise<boolean> {
    return (await this.repository.count({ where: { email: email.trim().toLowerCase() } })) > 0
  }

  public async count(): Promise<number> {
    return this.repository.count()
  }
}
