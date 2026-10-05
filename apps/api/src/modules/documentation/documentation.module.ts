import { Controller, Get, Header, Inject, Injectable, Module, VERSION_NEUTRAL, type OnModuleInit } from '@nestjs/common'
import { HttpAdapterHost } from '@nestjs/core'
import express from 'express'
import { dirname, join } from 'node:path'
import { API_VERSION, buildOpenApiDocument, type OpenApiDocument } from '@dme/contracts/http'
import { ENV } from '../../config/env'
import type { AppConfig } from '../../config/env'
import { Public } from '../../shared/http/authenticated-request'

/**
 * Builds the OpenAPI description of this deployment.
 *
 * The document is generated from the shared operation registry rather than from
 * controller decorators, so the published reference cannot drift from what the
 * web app and the API actually accept: the schemas below are the same zod
 * objects the client validates every response against.
 */
@Injectable()
export class OpenApiProvider {
  constructor(@Inject(ENV) private readonly config: AppConfig) {}

  public build(): OpenApiDocument {
    return buildOpenApiDocument({
      serverUrl: `/${this.config.apiPrefix}/${API_VERSION}`,
      title: 'Campaign Assistant API',
      version: API_VERSION,
    })
  }
}

/**
 * The machine-readable specification.
 *
 * Deliberately unversioned. The document describes every version of the API, so
 * it cannot itself live behind one: a client integrating `v2` still needs to
 * read what `v1` promised while it migrates.
 */
@Controller({ version: VERSION_NEUTRAL })
export class OpenApiController {
  constructor(private readonly openApi: OpenApiProvider) {}

  @Public()
  @Get('openapi.json')
  @Header('content-type', 'application/json')
  public document(): OpenApiDocument {
    return this.openApi.build()
  }
}

/**
 * The rendered reference: Swagger UI over the specification above.
 *
 * Assets are served from the installed `swagger-ui-dist` package rather than a
 * CDN, so the reference renders on an isolated network and no third party can
 * alter what a developer is shown. "Authorize" works because the UI stores the
 * bearer token from `auth.signIn`.
 */
@Controller({ path: 'docs', version: VERSION_NEUTRAL })
export class DocsController {
  constructor(@Inject(ENV) private readonly config: AppConfig) {}

  @Public()
  @Get()
  @Header('content-type', 'text/html')
  public index(): string {
    const specUrl = `/${this.config.apiPrefix}/openapi.json`
    const assetBase = `/${this.config.apiPrefix}/docs/assets`

    return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Campaign Assistant API — reference</title>
    <link rel="stylesheet" href="${assetBase}/swagger-ui.css" />
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="${assetBase}/swagger-ui-bundle.js" crossorigin></script>
    <script src="${assetBase}/swagger-ui-standalone-preset.js" crossorigin></script>
    <script>
      window.ui = SwaggerUIBundle({
        url: '${specUrl}',
        dom_id: '#swagger-ui',
        deepLinking: true,
        docExpansion: 'list',
        defaultModelsExpandDepth: 1,
        // The reference is only useful if a reader can call the endpoint from it.
        tryItOutEnabled: true,
        persistAuthorization: true,
        presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
        layout: 'StandaloneLayout',
      })
    </script>
  </body>
</html>`
  }
}

/**
 * Mounts the reference UI's static assets on the underlying Express instance.
 *
 * Served from the installed `swagger-ui-dist` package rather than a CDN: the
 * reference has to render on an isolated network, and nothing third party should
 * be able to change what a reader is shown. Express is used directly because the
 * Nest static-asset module is ESM-only and this service is compiled to CommonJS.
 */
@Injectable()
export class DocsAssetLoader implements OnModuleInit {
  constructor(
    private readonly adapterHost: HttpAdapterHost,
    @Inject(ENV) private readonly config: AppConfig,
  ) {}

  public onModuleInit(): void {
    const instance = this.adapterHost.httpAdapter.getInstance<express.Express>()
    instance.use(
      `/${this.config.apiPrefix}/docs/assets`,
      express.static(swaggerAssetDirectory(), { index: false, maxAge: '1h', fallthrough: true }),
    )
  }
}

/** Directory holding the bundled Swagger UI distribution. */
function swaggerAssetDirectory(): string {
  return dirname(require.resolve('swagger-ui-dist'))
}

/**
 * Documentation routes.
 *
 * Exported as its own module so the composition root stays a list of features,
 * and so a deployment can leave it out entirely.
 */
@Module({
  controllers: [OpenApiController, DocsController],
  providers: [OpenApiProvider, DocsAssetLoader],
  exports: [OpenApiProvider],
})
export class DocumentationModule {}

export { join }