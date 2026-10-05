import { Injectable, type CallHandler, type ExecutionContext, type NestInterceptor } from '@nestjs/common'
import type { Response } from 'express'
import type { OperationLike } from '@dme/contracts'
import { responseHeadersFor } from './deprecation'

/**
 * Publishes RFC 8594 deprecation signalling on the operations that need it.
 *
 * The decision lives in `deprecation.ts`; this class only reads the matched route
 * off the Express request and writes the headers onto the response.
 */
@Injectable()
export class DeprecationInterceptor implements NestInterceptor {
  public constructor(private readonly registry: Readonly<Record<string, OperationLike>>) {}

  public intercept(context: ExecutionContext, next: CallHandler) {
    const http = context.switchToHttp()
    const request = http.getRequest<{ method: string; route?: { path?: string }; path?: string }>()
    const response = http.getResponse<Response>()

    // `route.path` is the Express pattern (`/segments/:id`), which is also how the
    // registry declares paths, so neither side needs normalising.
    const headers = responseHeadersFor(
      { method: request.method, routePath: request.route?.path, path: request.path },
      this.registry,
    )

    for (const [header, value] of Object.entries(headers)) {
      response.setHeader(header, value)
    }

    return next.handle()
  }
}