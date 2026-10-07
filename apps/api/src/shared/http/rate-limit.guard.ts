import { Inject, Injectable, SetMetadata, applyDecorators } from '@nestjs/common'
import type { CanActivate, ExecutionContext } from '@nestjs/common'
import type { Request } from 'express'
import { RateLimitedError } from '../domain/domain.errors'
import { FixedWindowRateLimiter, RATE_LIMIT_RULES } from './rate-limit'
import type { RateLimitScope, RateVerdict } from './rate-limit'

export interface RateLimiterService {
  hit(scope: RateLimitScope, key: string): RateVerdict
}

/** Shared, per-process limiter backed by one bucket map per route scope. */
@Injectable()
export class RateLimitService implements RateLimiterService {
  private readonly limiters = new Map<RateLimitScope, FixedWindowRateLimiter>()

  public hit(scope: RateLimitScope, key: string): RateVerdict {
    let limiter = this.limiters.get(scope)
    if (limiter === undefined) {
      limiter = new FixedWindowRateLimiter(RATE_LIMIT_RULES[scope])
      this.limiters.set(scope, limiter)
    }
    return limiter.hit(key)
  }
}

/**
 * Limits how often a liberal endpoint can be called from one source.
 *
 * Applied per route with `@RateLimit('sign-in')`. The scope decides the rule and
 * what the bucketing key is: sign-in keys by IP *and* account, so hammering one
 * account from many addresses still burns the shared window on that account.
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  public constructor(@Inject(RateLimitService) private readonly service: RateLimiterService) {}

  public canActivate(context: ExecutionContext): boolean {
    const scope = Reflect.getMetadata(RATE_LIMIT_SCOPE, context.getHandler()) as RateLimitScope
    const request = context.switchToHttp().getRequest<Request & { body?: { email?: unknown } }>()
    const ip = String(request.ip ?? 'unknown')
    const account = scope === 'sign-in' ? String(request.body?.email ?? '').trim().toLowerCase() : ''
    const verdict = this.service.hit(scope, `${scope}:${ip}:${account}`)
    if (!verdict.allowed) {
      throw new RateLimitedError('Too many attempts. Try again shortly.', verdict.retryAfterSeconds)
    }
    return true
  }
}

const RATE_LIMIT_SCOPE = 'rate-limit-scope'

/** Opts a route into rate limiting, bucketed by the named scope. */
export function RateLimit(scope: RateLimitScope): MethodDecorator {
  return applyDecorators(SetMetadata(RATE_LIMIT_SCOPE, scope))
}