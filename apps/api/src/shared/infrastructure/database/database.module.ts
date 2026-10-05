import { Global, Module } from '@nestjs/common'
import { TypeOrmModule, type TypeOrmModuleOptions } from '@nestjs/typeorm'
import { ENV } from '../../../config/env'
import type { AppConfig } from '../../../config/env'
import { CampaignOrmEntity } from '../persistence/campaign.orm-entity'
import { ChatMessageOrmEntity } from '../persistence/chat-message.orm-entity'
import { ChatThreadOrmEntity } from '../persistence/chat-thread.orm-entity'
import { CustomerOrmEntity } from '../persistence/customer.orm-entity'
import { SegmentConditionOrmEntity } from '../persistence/segment-condition.orm-entity'
import { SegmentOrmEntity } from '../persistence/segment.orm-entity'
import { SessionOrmEntity } from '../persistence/session.orm-entity'
import { UserOrmEntity } from '../persistence/user.orm-entity'

export const PERSISTENCE_ENTITIES = [
  UserOrmEntity,
  SessionOrmEntity,
  CustomerOrmEntity,
  SegmentOrmEntity,
  SegmentConditionOrmEntity,
  CampaignOrmEntity,
  ChatThreadOrmEntity,
  ChatMessageOrmEntity,
] as const

function buildOptions(config: AppConfig): TypeOrmModuleOptions {
  return {
    type: 'postgres',
    host: config.database.host,
    port: config.database.port,
    database: config.database.name,
    username: config.database.user,
    password: config.database.password,
    ssl: config.database.ssl ? { rejectUnauthorized: false } : false,
    entities: [...PERSISTENCE_ENTITIES],
    /**
     * Schema is managed from the entity metadata while the project is in
     * development. Before the first production deploy this switches to generated
     * migrations — see README "Database".
     */
    synchronize: config.env !== 'production',
    logging: config.env === 'development' ? ['error', 'warn'] : ['error'],
  }
}

/**
 * Infrastructure module: the single place that knows a database exists. Nothing
 * else in the codebase imports TypeORM.
 */
@Global()
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ENV],
      useFactory: (config: AppConfig): TypeOrmModuleOptions => buildOptions(config),
    }),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}