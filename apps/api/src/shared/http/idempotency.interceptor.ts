import { Inject, Injectable, SetMetadata, applyDecorators } from '@nestjs/common'
import { lastValueFrom, of } from 'rxjs'
import type { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common'
import type { Observable } from 'rxjs'
import type { Response } from 'express'
import { IDEMPOTENCY_STORE } from '../application/ports/idempotency-store.port'
import type { IdempotencyStore, JsonValue } from '../application/ports/idempotency-store.port'
import type { AuthenticatedRequest } from './authenticated-request'
import { coordinate, fingerprint, IDEMPOTENCY_KEY_HEADER, IDEMPOTENCY_REPLAYED_HEADER, IDEMPOTENT_ROUTE, parseKey } from './idempotency'

/** Opts a route into idempotent replay. The route must be authenticated. */
export function Idempotent(): MethodDecorator {
  return applyDecorators(SetMetadata(IDEMPOTENT_ROUTE, true))
}

/** The request fields the interceptor reads. */
interface ReplayableRequest extends AuthenticatedRequest {
  method: string
  path?: string
  body?: unknown
  header?: (name: string) => string | undefined
}

/**
 * Answers a repeated request with the response it already produced.
 *
 * This sits at the HTTP edge because idempotency is a statement about a *request*,
 * not about a domain operation — the campaign use case stays unaware it can be
 * replayed. All of the policy lives in `idempotency.ts`; this only translates
 * between it and Nest.
 *
 * Records are keyed per authenticated caller, so one member of the workspace cannot
 * replay another's key.
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  public constructor(@Inject(IDEMPOTENCY_STORE) private readonly store: IdempotencyStore) {}

  public async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const http = context.switchToHttp()
    const request = http.getRequest<ReplayableRequest>()
    const response = http.getResponse<Response>()

    const key = parseKey(request.header?.(IDEMPOTENCY_KEY_HEADER))
    // No key means the client did not ask for replay semantics, so the route behaves
    // exactly as it always has.
    if (key === null) return next.handle()

    // Scoping to the caller is what keeps a key private to them. A marked route with
    // no authenticated user is a wiring mistake, and guessing a scope would quietly
    // let keys collide across callers.
    const scope = request.user?.id
    if (scope === undefined) {
      throw new Error(`@Idempotent() was applied to an unauthenticated route: ${request.method} ${request.path}`)
    }

    const digest = fingerprint(request.method, request.path ?? '', request.body)

    const outcome = await coordinate(this.store, {
      scope,
      key,
      digest,
      execute: async () => {
        // A Nest handler resolves with the value its controller returned, which is the
        // body about to be serialised — so it is JSON by construction.
        const body = (await lastValueFrom(next.handle())) as JsonValue
        // By the time the handler has resolved, Nest has already applied `@HttpCode(...)`
        // to the response, so this is the status the caller is about to be sent.
        return { statusCode: response.statusCode, body }
      },
    })

    if (outcome.replay) response.setHeader(IDEMPOTENCY_REPLAYED_HEADER, 'true')
    // A replay restores the recorded status rather than trusting `@HttpCode`, so it
    // stays byte-for-byte what the first caller received even if the route's declared
    // status changes in a later release.
    response.status(outcome.statusCode)
    return of(outcome.body)
  }
}