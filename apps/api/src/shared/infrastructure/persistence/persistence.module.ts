import { Global, Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { IDEMPOTENCY_STORE } from '../../application/ports/idempotency-store.port'
import { IdempotencyRecordOrmEntity } from './idempotency-record.orm-entity'
import { TypeOrmIdempotencyStore } from './typeorm-idempotency.store'

/**
 * Persistence for the cross-cutting HTTP concerns, which need a table but belong to
 * no single feature module.
 *
 * Global so the idempotency interceptor can be attached to a controller in any
 * module without that module importing an infrastructure module to satisfy it.
 */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([IdempotencyRecordOrmEntity])],
  providers: [{ provide: IDEMPOTENCY_STORE, useClass: TypeOrmIdempotencyStore }],
  exports: [IDEMPOTENCY_STORE],
})
export class PersistenceModule {}