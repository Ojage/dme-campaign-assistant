import * as z from 'zod/v4'
import {
  type Api,
  type BodyOf,
  type CallOptions,
  type OperationName,
  type ResultOf,
  type StreamBodyOf,
  type StreamEventOf,
  type StreamName,
  type StreamOptions,
  type StreamingApi,
  ApiError,
  operations,
  streamingOperations,
} from './api.js'
import { isProblem, type ErrorCode } from './problem.js'
import { versionedPath } from './version.js'

/** Where the client keeps credentials. Supplied by the host app, not the client. */
export interface TokenStore {
  getAccessToken: () => string | null
  setAccessToken: (token: string | null) => void
  getRefreshToken: () => string | null
  setRefreshToken: (token: string | null) => void
  clear: () => void
}

export interface HttpClientOptions {
  baseUrl: string
  tokens: TokenStore
  fetchImpl?: typeof fetch
  /** Called when a refresh fails, so the app can drop to the login screen. */
  onSessionLost?: () => void
}

const STATUS_TO_CODE: Readonly<Record<number, ErrorCode>> = {
  400: 'validation_failed',
  401: 'unauthenticated',
  403: 'forbidden',
  404: 'not_found',
  409: 'conflict',
  422: 'validation_failed',
  429: 'rate_limited',
}

function toApiError(status: number, payload: unknown): ApiError {
  if (isProblem(payload)) {
    return new ApiError(payload.code, payload.detail, payload.status, payload.errors, payload.traceId)
  }
  const code = STATUS_TO_CODE[status] ?? 'internal_error'
  return new ApiError(code, `Request failed with status ${status}`, status)
}

/**
 * Substitutes path parameters, then prefixes the API version.
 *
 * The version lives in the path rather than a header so a bookmarked URL keeps
 * pointing at the same contract; see `version.ts` for the policy.
 */
function buildPath(template: string, params: Readonly<Record<string, string>> | undefined): string {
  return template.replace(/:([A-Za-z0-9_]+)/g, (_match, key: string) => {
    const value = params?.[key]
    if (value === undefined) throw new Error(`Missing path parameter "${key}" for ${template}`)
    return encodeURIComponent(value)
  })
}

/**
 * An operation's query type is a precise object type, but at the call site inside
 * the generic client TypeScript widens it to `object`. This narrows it back for
 * URL building, in one documented place instead of scattering assertions.
 */
function asRecord(value: unknown): Readonly<Record<string, unknown>> | undefined {
  return typeof value === 'object' && value !== null
    ? (value as Readonly<Record<string, unknown>>)
    : undefined
}

/** Drops empty values so callers can pass filters straight through without pruning. */
function buildQuery(query: Readonly<Record<string, unknown>> | undefined): string {
  if (query === undefined) return ''
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue
    search.set(key, String(value))
  }
  const serialised = search.toString()
  return serialised.length > 0 ? `?${serialised}` : ''
}

/** Splits an SSE byte stream into `data:` payloads. */
async function* readEventStream(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      let boundary = buffer.indexOf('\n\n')
      while (boundary !== -1) {
        const frame = buffer.slice(0, boundary)
        buffer = buffer.slice(boundary + 2)
        const data = frame
          .split('\n')
          .filter((line) => line.startsWith('data:'))
          .map((line) => line.slice(5).trim())
          .join('\n')
        if (data.length > 0) yield data
        boundary = buffer.indexOf('\n\n')
      }
    }
  } finally {
    reader.releaseLock()
  }
}

/**
 * Typed HTTP transport for the Campaign Assistant API.
 *
 * The operation name is the only input: request and response types are derived
 * from the zod schema registered for it, responses are validated on arrival, and
 * an expired access token is refreshed once before the call is replayed.
 */
export class HttpClient {
  readonly #baseUrl: string
  readonly #tokens: TokenStore
  readonly #fetch: typeof fetch
  readonly #onSessionLost: (() => void) | undefined
  /** Single-flight guard so ten parallel 401s trigger one refresh, not ten. */
  #refreshing: Promise<string | null> | null = null

  public constructor(options: HttpClientOptions) {
    this.#baseUrl = options.baseUrl.replace(/\/$/, '')
    this.#tokens = options.tokens
    this.#fetch = options.fetchImpl ?? ((input, init) => fetch(input, init))
    this.#onSessionLost = options.onSessionLost
  }

  public async call<TName extends OperationName>(name: TName, options: CallOptions<TName> = {}): Promise<ResultOf<TName>> {
    const spec: Api[TName] = operations[name]
    const request = this.#buildRequest(
      spec,
      options.params,
      asRecord(options.query),
      options.body as BodyOf<TName> | undefined,
    )

    const response = spec.auth ? await this.#sendAuthorized(request) : await this.#fetch(request)
    const payload = await readJson(response)

    if (!response.ok) throw toApiError(response.status, payload)

    const parsed = (spec.response as z.ZodTypeAny).safeParse(payload)
    if (!parsed.success) {
      // The server answered something the shared contract does not describe —
      // a deployment mismatch, so surface it loudly instead of casting it.
      throw new Error(`Contract violation on "${name}": ${parsed.error.message}`)
    }
    return parsed.data as ResultOf<TName>
  }

  /** Yields validated stream events until the server closes the connection. */
  public async *stream<TName extends StreamName>(
    name: TName,
    options: StreamOptions<TName> = {},
  ): AsyncGenerator<StreamEventOf<TName>, void, undefined> {
    const spec: StreamingApi[TName] = streamingOperations[name]
    const request = this.#buildRequest(spec, options.params, undefined, options.body as StreamBodyOf<TName> | undefined)
    const response = spec.auth ? await this.#sendAuthorized(request) : await this.#fetch(request)

    if (!response.ok || response.body === null) {
      throw toApiError(response.status, await readJson(response))
    }

    const eventSchema = spec.event as z.ZodTypeAny
    for await (const payload of readEventStream(response.body)) {
      let decoded: unknown
      try {
        decoded = JSON.parse(payload)
      } catch {
        throw new Error(`Malformed stream frame on "${name}"`)
      }
      const parsed = eventSchema.safeParse(decoded)
      if (!parsed.success) throw new Error(`Contract violation on "${name}": ${parsed.error.message}`)
      yield parsed.data as StreamEventOf<TName>
    }
  }

  #buildRequest(
    spec: { readonly path: string; readonly body?: z.ZodTypeAny },
    params: Readonly<Record<string, string>> | undefined,
    query: Readonly<Record<string, unknown>> | undefined,
    body: unknown,
  ): Request {
    const headers: Record<string, string> = { accept: 'application/json, text/event-stream' }
    if (spec.body !== undefined && body !== undefined) headers['content-type'] = 'application/json'

    return new Request(`${this.#baseUrl}${versionedPath(buildPath(spec.path, params))}${buildQuery(query)}`, {
      method: 'GET',
      headers,
      ...(spec.body !== undefined && body !== undefined ? { body: JSON.stringify(body) } : {}),
    })
  }

  async #sendAuthorized(request: Request): Promise<Response> {
    const send = (): Promise<Response> => {
      const token = this.#tokens.getAccessToken()
      const headers = new Headers(request.headers)
      if (token !== null) headers.set('authorization', `Bearer ${token}`)
      // Request bodies are single-use streams, so each attempt gets a fresh clone.
      return this.#fetch(new Request(request, { headers }))
    }

    const response = await send()
    if (response.status !== 401) return response

    const token = await this.#refresh()
    if (token === null) {
      this.#onSessionLost?.()
      return response
    }
    return send()
  }

  #refresh(): Promise<string | null> {
    if (this.#refreshing !== null) return this.#refreshing

    const refreshToken = this.#tokens.getRefreshToken()
    if (refreshToken === null) return Promise.resolve(null)

    const attempt = (async (): Promise<string | null> => {
      try {
        const response = await this.#fetch(
          new Request(`${this.#baseUrl}${operations['auth.refresh'].path}`, {
            method: 'POST',
            headers: { 'content-type': 'application/json', accept: 'application/json' },
            body: JSON.stringify({ refreshToken }),
          }),
        )
        if (!response.ok) {
          this.#tokens.clear()
          return null
        }
        const parsed = z
          .object({ accessToken: z.string().min(1) })
          .parse(await response.json())
        this.#tokens.setAccessToken(parsed.accessToken)
        return parsed.accessToken
      } catch {
        this.#tokens.clear()
        return null
      } finally {
        this.#refreshing = null
      }
    })()

    this.#refreshing = attempt
    return attempt
  }
}

async function readJson(response: Response): Promise<unknown> {
  if (response.status === 204) return null
  const text = await response.text()
  if (text.length === 0) return null
  try {
    return JSON.parse(text) as unknown
  } catch {
    return null
  }
}