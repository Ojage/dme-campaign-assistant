import { Module } from '@nestjs/common'
import { APP_FILTER, APP_GUARD } from '@nestjs/core'
import { AuthModule } from './modules/auth/auth.module'
import { CampaignsModule } from './modules/campaigns/campaigns.module'
import { ChatModule } from './modules/chat/chat.module'
import { CustomersModule } from './modules/customers/customers.module'
import { DocumentationModule } from './modules/documentation/documentation.module'
import { SegmentsModule } from './modules/segments/segments.module'
import { ConfigModuleRoot } from './config/config.module'
import { AccessTokenGuard } from './shared/http/access-token.guard'
import { ProblemDetailsFilter } from './shared/http/problem-details.filter'
import { DatabaseModule } from './shared/infrastructure/database/database.module'

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
    AuthModule,
    CustomersModule,
    SegmentsModule,
    CampaignsModule,
    ChatModule,
    DocumentationModule,
  ],
  providers: [
    // Every route requires a bearer token; @Public() opts out.
    { provide: APP_GUARD, useClass: AccessTokenGuard },
    { provide: APP_FILTER, useClass: ProblemDetailsFilter },
  ],
})
export class AppModule {}
