import * as z from 'zod/v4'

/**
 * Every failure the API can produce is one of these codes. The UI maps a code to
 * a translated message, so codes are part of the contract and must stay stable.
 */
export const errorCodeSchema = z.enum([
  'validation_failed',
  'invalid_credentials',
  'unauthenticated',
  'session_expired',
  'forbidden',
  'not_found',
  'conflict',
  'rate_limited',
  'llm_unavailable',
  'llm_error',
  'internal_error',
])
export type ErrorCode = z.infer<typeof errorCodeSchema>

/** RFC 9457 problem details. */
export const problemSchema = z.object({
  type: z.string(),
  title: z.string(),
  status: z.number().int(),
  detail: z.string(),
  code: errorCodeSchema,
  /** Field-level messages, keyed by the offending input path. */
  errors: z.record(z.string(), z.array(z.string())).optional(),
  traceId: z.string().optional(),
})
export type Problem = z.infer<typeof problemSchema>

/** A failure surfaced by the client, carrying the machine-readable code. */
export class ApiError extends Error {
  public constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly status: number,
    public readonly fieldErrors?: Readonly<Record<string, string[]>>,
    public readonly traceId?: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }

  /** True when the session is gone and the user must sign in again. */
  public get isUnauthenticated(): boolean {
    return this.code === 'unauthenticated' || this.code === 'session_expired'
  }
}

/** Narrowing helper for unknown values caught at a trust boundary. */
export function isProblem(value: unknown): value is Problem {
  return problemSchema.safeParse(value).success
}