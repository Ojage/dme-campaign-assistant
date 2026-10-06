import { Module } from '@nestjs/common'
import { APP_FILTER, APP_GUARD } from '@nestjs/core'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AUTH_PORTS } from './auth.tokens'
import { ENV } from '../../config/env'
import type { AppConfig } from '../../config/env'
import {
  AuthenticateAccessToken,
  RefreshSession,
  SignIn,
  SignOut,
} from './application/use-cases/auth.use-cases'
import { BcryptPasswordHasher } from './infrastructure/bcrypt-password.hasher'
import { JwtTokenService } from './infrastructure/jwt-token.service'
import { TypeOrmSessionRepository } from './infrastructure/typeorm-session.repository'
import { TypeOrmUserRepository } from './infrastructure/typeorm-user.repository'
import { AuthController } from './interface/http/auth.controller'
import { AccessTokenGuard } from '../../shared/http/access-token.guard'
import { ProblemDetailsFilter } from '../../shared/http/problem-details.filter'
import { SessionOrmEntity } from '../../shared/infrastructure/persistence/session.orm-entity'
import { UserOrmEntity } from '../../shared/infrastructure/persistence/user.orm-entity'

/**
 * Composition root for authentication.
 *
 * Every outbound port is bound to a concrete adapter here and nowhere else; the
 * use cases only ever see the interfaces from `auth.ports.ts`.
 *
 * The module also owns the two cross-cutting HTTP concerns, because both depend on
 * authentication: the guard that protects every route and the filter that renders
 * every domain error as problem details.
 */
@Module({
  imports: [TypeOrmModule.forFeature([UserOrmEntity, SessionOrmEntity])],
  controllers: [AuthController],
  providers: [
    SignIn,
    RefreshSession,
    SignOut,
    AuthenticateAccessToken,
    { provide: AUTH_PORTS.userRepository, useClass: TypeOrmUserRepository },
    { provide: AUTH_PORTS.passwordHasher, useClass: BcryptPasswordHasher },
    // The service is a plain class so it can be tested without a container; this
    // factory is what gives it the config and makes it injectable.
    { provide: AUTH_PORTS.tokenService, inject: [ENV], useFactory: (config: AppConfig) => new JwtTokenService(config) },
    { provide: AUTH_PORTS.sessionRepository, useClass: TypeOrmSessionRepository },
    { provide: APP_GUARD, useClass: AccessTokenGuard },
    { provide: APP_FILTER, useClass: ProblemDetailsFilter },
  ],
  exports: [SignIn, RefreshSession, SignOut, AuthenticateAccessToken],
})
export class AuthModule {}