import {
  Injectable,
  type ArgumentsHost,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common'
import type { ErrorCode, Problem } from '@dme/contracts'
import type { Response } from 'express'
import { DomainError, RateLimitedError } from '../domain/domain.errors'

const STATUS_TO_CODE: Readonly<Record<number, ErrorCode>> = {
  400: 'validation_failed',
  401: 'unauthenticated',
  403: 'forbidden',
  404: 'not_found',
  405: 'not_found',
  409: 'conflict',
  413: 'validation_failed',
  422: 'validation_failed',
  429: 'rate_limited',
}

/**
 * Single exit point for every failure. Turns domain errors into RFC 9457 problem
 * details so the web app can branch on `code` instead of parsing prose, and keeps
 * internal details out of 5xx responses.
 */
@Injectable()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemDetailsFilter.name)

  public catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>()
    const request = host.switchToHttp().getRequest<{ method: string; url: string }>()

    if (exception instanceof DomainError) {
      if (exception instanceof RateLimitedError) {
        response.setHeader('Retry-After', String(exception.retryAfterSeconds))
      }
      response.status(exception.status).json(this.toProblem(exception.status, exception.code, exception.message, exception.fieldErrors))
      return
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus()
      const detail = this.readDetail(exception)
      response.status(status).json(this.toProblem(status, STATUS_TO_CODE[status] ?? 'internal_error', detail))
      return
    }

    this.logger.error(
      `Unhandled ${request.method} ${request.url}`,
      exception instanceof Error ? exception.stack : String(exception),
    )
    response
      .status(HttpStatus.INTERNAL_SERVER_ERROR)
      .json(this.toProblem(HttpStatus.INTERNAL_SERVER_ERROR, 'internal_error', 'An unexpected error occurred.'))
  }

  private toProblem(
    status: number,
    code: ErrorCode,
    detail: string,
    errors?: Readonly<Record<string, string[]>>,
  ): Problem {
    return {
      type: `https://api.dme.campaigns/problems/${code}`,
      title: code.replace(/_/g, ' '),
      status,
      detail,
      code,
      ...(errors === undefined ? {} : { errors }),
    }
  }

  /** Prefer the message a Nest exception was constructed with. */
  private readDetail(exception: HttpException): string {
    const payload = exception.getResponse()
    if (typeof payload === 'string') return payload
    if (typeof payload === 'object' && payload !== null && 'message' in payload) {
      const { message } = payload as { message: unknown }
      if (typeof message === 'string') return message
      if (Array.isArray(message)) return 'One or more fields are invalid.'
    }
    return exception.message
  }
}