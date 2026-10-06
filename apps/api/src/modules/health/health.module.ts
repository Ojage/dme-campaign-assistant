import { Controller, Get, Module, VERSION_NEUTRAL } from '@nestjs/common'
import { API_VERSION } from '@dme/contracts/http'
import { Public } from '../../shared/http/authenticated-request'

/**
 * Liveness probe.
 *
 * Answering at all is the whole check: the process booted, the container is up
 * and the route is reachable. It deliberately does not touch the database — a
 * probe that fails when Postgres is briefly unavailable would report the API as
 * dead while it is healthy, and the database already carries its own healthcheck
 * in the compose stack. The reverse proxy and the deployment gate both read this
 * endpoint, so its path must stay unversioned and public.
 */
@Controller({ path: 'health', version: VERSION_NEUTRAL })
export class HealthController {
  @Public()
  @Get()
  public liveness(): { readonly status: 'ok'; readonly service: string; readonly version: string } {
    return { status: 'ok', service: 'campaign-assistant-api', version: API_VERSION }
  }
}

@Module({
  controllers: [HealthController],
})
export class HealthModule {}
