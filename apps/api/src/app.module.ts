import { Module } from '@nestjs/common'
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core'
import { AuthModule } from './modules/auth/auth.module'
import { CampaignsModule } from './modules/campaigns/campaigns.module'
import { ChatModule } from './modules/chat/chat.module'
import { CustomersModule } from './modules/customers/customers.module'
import { DocumentationModule } from './modules/documentation/documentation.module'
import { HealthModule } from './modules/health/health.module'
import { DeprecationInterceptor } from './shared/http/deprecation.interceptor'
import { apiRegistry } from './shared/http/deprecation'
import { SearchModule } from './modules/search/search.module'
import { SegmentsModule } from './modules/segments/segments.module'
import { ConfigModuleRoot } from './config/config.module'
import { AccessTokenGuard } from './shared/http/access-token.guard'
import { ProblemDetailsFilter } from './shared/http/problem-details.filter'
import { DatabaseModule } from './shared/infrastructure/database/database.module'
import { PersistenceModule } from './shared/infrastructure/persistence/persistence.module'

/**
 * Composition root.
 *
 * Module wiring, the config provider and the two global cross-cutting concerns
 * live here and nowhere else, so every feature module stays unaware of them.
 */
@Module({
  imports: [
    ConfigModuleRoot,
    DatabaseModule,
    PersistenceModule,
    AuthModule,
    CustomersModule,
    SegmentsModule,
    CampaignsModule,
    ChatModule,
    SearchModule,
    DocumentationModule,
    HealthModule,
  ],
  providers: [
    // Every route requires a bearer token; @Public() opts out.
    { provide: APP_GUARD, useClass: AccessTokenGuard },
    {
      provide: APP_INTERCEPTOR,
      // The registry is passed explicitly so the interceptor has no ambient
      // dependency beyond the module that documents the API.
      useFactory: (): DeprecationInterceptor => new DeprecationInterceptor(apiRegistry),
    },
    { provide: APP_FILTER, useClass: ProblemDetailsFilter },
  ],
})
export class AppModule {}
