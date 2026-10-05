import 'reflect-metadata'
import { Logger, VersioningType } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { json, urlencoded } from 'express'
import type { NestExpressApplication } from '@nestjs/platform-express'
import { API_VERSION, API_VERSION_HEADER } from '@dme/contracts/http'
import { AppModule } from './app.module'
import { ENV } from './config/env'
import type { AppConfig } from './config/env'

/**
 * HTTP entry point. Composition happens here and nowhere else: every module is
 * assembled by Nest's injector, so a module never reaches for another one
 * directly to build it.
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule)
  const config = app.get<AppConfig>(ENV)
  const logger = new Logger('Bootstrap')

  // Mounted under a prefix so the API can share an origin with the static web app.
  app.setGlobalPrefix(config.apiPrefix)
  // Version in the URL: visible in logs, caches and curl, and a bookmarked request
  // cannot silently drift onto a different contract. See docs/api-versioning.md.
  //
  // `prefix: false` because API_VERSION already carries the `v`; Nest would
  // otherwise insert its own and produce `/api/vv1/...`.
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: API_VERSION, prefix: false })
  app.enableCors({
    origin: [...config.corsOrigins],
    credentials: true,
  })

  // Body parsers are configured explicitly so the SSE route is not buffered.
  app.use(json({ limit: '1mb' }))
  app.use(urlencoded({ extended: true }))

  // Every response states the version that answered it, so a client can detect a
  // deployment that is not the one it was built against.
  app.use((_request: unknown, response: { setHeader: (name: string, value: string) => void }, next: () => void) => {
    response.setHeader(API_VERSION_HEADER, API_VERSION)
    next()
  })

  await app.listen(config.port)

  logger.log(`API listening on http://localhost:${config.port}/${config.apiPrefix}/${API_VERSION}`)
  logger.log(`Reference: http://localhost:${config.port}/${config.apiPrefix}/docs`)
  if (!config.anthropic.enabled) {
    logger.warn('ANTHROPIC_API_KEY is not set — the local scripted generator will be used instead.')
  }
}

void bootstrap().catch((error: unknown) => {
  new Logger('Bootstrap').error('The API failed to start.', error instanceof Error ? error.stack : undefined)
  process.exitCode = 1
})