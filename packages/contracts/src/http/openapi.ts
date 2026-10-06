import * as z from 'zod/v4'
import { operations, streamingOperations, type HttpMethod, type Operation } from './api.js'
import { errorCodeSchema, problemSchema, type ErrorCode } from './problem.js'
import { API_VERSION, versionedPath } from './version.js'

/**
 * OpenAPI 3.1 generation from the operation registry.
 *
 * The registry is the single source of truth, so the specification cannot drift
 * from the code: schemas come from the same zod objects the client validates
 * with and the API validates requests against. There are no duplicated
 * annotations — no controller decorators restating a shape that already exists.
 *
 * 3.1 rather than 3.0 because the JSON Schema it embeds is the same dialect zod
 * emits, so nothing has to be downgraded on the way out.
 */

/** Error code to HTTP status. The server and this table must agree. */
const errorStatus: Record<ErrorCode, number> = {
  validation_failed: 400,
  invalid_credentials: 401,
  unauthenticated: 401,
  session_expired: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  rate_limited: 429,
  llm_unavailable: 503,
  llm_error: 502,
  internal_error: 500,
}

const statusText: Record<number, string> = {
  200: 'OK',
  201: 'Created',
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  409: 'Conflict',
  422: 'Unprocessable Content',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  502: 'Bad Gateway',
  503: 'Service Unavailable',
}

export interface OpenApiOptions {
  readonly serverUrl: string
  readonly title?: string
  readonly version?: string
  readonly description?: string
}

/** Shape of the document this module emits; kept structural, not a giant type. */
export type OpenApiDocument = Record<string, unknown>

/** Section order in the rendered reference, and the tag descriptions. */
const tagDescriptions: Record<string, string> = {
  Authentication: 'Sign-in, token rotation and sign-out.',
  Customers: 'The customer base: records, aggregates and bulk import.',
  Segments: 'Saved audience definitions and live audience counts.',
  Campaigns: 'Model-assisted campaign drafting and its review workflow.',
  Chat: 'Assistant threads, including server-sent streaming of replies.',
}

/**
 * Emits an OpenAPI 3.1 document covering every registered operation.
 *
 * Request bodies are described from the *input* side of their schema and
 * responses from the *output* side, which is what lets a field that is written
 * loosely and read back strictly (a customer payload, a condition threshold) be
 * documented with its accepted and returned shapes respectively.
 */
export function buildOpenApiDocument(options: OpenApiOptions): OpenApiDocument {
  const paths: Record<string, Record<string, unknown>> = {}
  const componentSchemas: Record<string, unknown> = {}

  for (const [name, spec] of Object.entries(operations)) {
    addOperation(paths, componentSchemas, name, spec)
  }
  for (const [name, spec] of Object.entries(streamingOperations)) {
    addOperation(paths, componentSchemas, name, spec)
  }

  // The problem document and the error-code union are shared by every operation,
  // so they are described once as named components and referenced from each failure.
  componentSchemas['Problem'] ??= toJsonSchema(problemSchema, 'output')
  componentSchemas['ErrorCode'] ??= toJsonSchema(errorCodeSchema, 'output')

  return {
    openapi: '3.1.0',
    info: {
      title: options.title ?? 'Campaign Assistant API',
      version: options.version ?? API_VERSION,
      summary: 'Campaign drafting over a shared, runtime-validated contract.',
      description:
        options.description ??
        'Every endpoint below is described by the shared contract package: the request and response schemas served here are the ones the web app validates against at runtime.\n\n' +
          'Authentication is a bearer access token obtained from `auth.signIn`. Errors are always an RFC 9457 problem document. Chat replies can be streamed as server-sent events; see `chat.messages.stream`.',
      license: { name: 'UNLICENSED', identifier: 'UNLICENSED' },
    },
    servers: [{ url: options.serverUrl, description: 'This deployment' }],
    security: [{ bearerAuth: [] }],
    tags: Object.entries(tagDescriptions).map(([name, description]) => ({ name, description })),
    paths,
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Access token issued by `auth.signIn`. Expires; refresh it with `auth.refresh`.',
        },
      },
      headers: {
        ApiVersion: {
          description: 'The API version that answered this request.',
          schema: { type: 'string', const: API_VERSION, examples: [API_VERSION] },
        },
      },
      schemas: componentSchemas,
    },
  }
}

/**
 * The union the document builder needs: everything an operation can declare,
 * whether it answers with one JSON body or with a stream of events.
 */
type DocumentedOperation = Pick<
  Operation,
  | 'method'
  | 'path'
  | 'params'
  | 'body'
  | 'query'
  | 'auth'
  | 'summary'
  | 'description'
  | 'tags'
  | 'errors'
  | 'deprecated'
  | 'idempotent'
> &
  Partial<Pick<Operation, 'response'>> & {
    /** Present on streaming operations, which have no JSON response body. */
    readonly event?: z.ZodTypeAny
  }

/** Registers one operation under its `path` + `method` and collects its schemas. */
function addOperation(
  paths: Record<string, Record<string, unknown>>,
  componentSchemas: Record<string, unknown>,
  name: string,
  spec: DocumentedOperation,
): void {
  const method = spec.method.toLowerCase()
  // Express writes `:id`; OpenAPI writes `{id}`.
  const path = versionedPath(spec.path.replace(/:([A-Za-z0-9_]+)/g, '{$1}'))

  const parameters: Array<Record<string, unknown>> = []
  if (spec.params !== undefined) {
    const shape = shapeOf(spec.params)
    for (const [key, schema] of Object.entries(shape)) {
      parameters.push({
        name: key,
        in: 'path',
        required: true,
        schema: toJsonSchema(schema as z.ZodTypeAny, 'input'),
        description: `Identifier of the ${key.endsWith('Id') ? 'thread' : 'resource'} being addressed.`,
      })
    }
  }

  if (spec.query !== undefined) {
    const shape = shapeOf(spec.query)
    for (const [key, schema] of Object.entries(shape)) {
      parameters.push({
        name: key,
        in: 'query',
        // A field is optional when its schema fills in a default.
        required: !(schema as z.ZodTypeAny).safeParse(undefined).success,
        schema: toJsonSchema(schema as z.ZodTypeAny, 'input'),
      })
    }
  }

  // Published as a parameter so a client can see, without reading prose, that this
  // operation is safe to retry and how the server recognises the repeat.
  if (spec.idempotent === true) {
    parameters.push({
      name: 'Idempotency-Key',
      in: 'header',
      required: false,
      schema: { type: 'string', minLength: 1, maxLength: 255, pattern: '^[\\x21-\\x7e]+$' },
      description:
        'Makes this call safe to retry. The first response is recorded against the key; a repeat of the same request returns it with `Idempotency-Replayed: true` instead of repeating the side effect. Reusing a key for a different request body is rejected with `conflict`. Only a successful response is recorded, so a failed attempt stays retryable with the same key.',
    })
  }

  const requestBody =
    spec.body === undefined
      ? undefined
      : {
          required: true,
          content: { 'application/json': { schema: dereference(spec.body as z.ZodTypeAny, 'input', componentSchemas) } },
        }

  const responses: Record<string, unknown> = {}

  if (spec.event !== undefined) {
    // Server-sent events: one media type, described as text because a frame is
    // a `data:` line holding a JSON event, not a JSON document.
    responses['200'] = {
      description: 'A stream of chat events.',
      headers: { 'x-api-version': { $ref: '#/components/headers/ApiVersion' } },
      content: { 'text/event-stream': { schema: { type: 'string' }, example: 'event: message\ndata: {"type":"delta","content":"Bonjour"}' } },
    }
  } else {
    responses['200'] = {
      description: statusText[200],
      headers: { 'x-api-version': { $ref: '#/components/headers/ApiVersion' } },
      content: {
        'application/json': { schema: dereference(spec.response as z.ZodTypeAny, 'output', componentSchemas) },
      },
    }
  }

  for (const code of errorResponses(spec)) {
    responses[String(code)] = {
      description: statusText[code] ?? 'Error',
      content: { 'application/problem+json': { schema: { $ref: '#/components/schemas/Problem' } } },
    }
  }

  if (spec.auth) responses['401'] ??= unauthorizedResponse()

  const entry: Record<string, unknown> = {
    operationId: name,
    summary: spec.summary,
    description: spec.description,
    tags: [...spec.tags],
    deprecated: spec.deprecated === true ? true : undefined,
    // Stated per operation: the document-level default applies to protected
    // routes, and an empty list is how a public route opts out of it.
    security: spec.auth ? [{ bearerAuth: [] }] : [],
    parameters: parameters.length > 0 ? parameters : undefined,
    requestBody,
    responses,
  }

  paths[path] ??= {}
  paths[path][method] = entry
}

function unauthorizedResponse(): Record<string, unknown> {
  return {
    description: statusText[401],
    content: { 'application/problem+json': { schema: { $ref: '#/components/schemas/Problem' } } },
  }
}

/** Status codes an operation can fail with, always including `internal_error`. */
function errorResponses(spec: DocumentedOperation): number[] {
  const codes: ErrorCode[] = ['internal_error', ...(spec.errors ?? [])]
  const statuses = new Set<number>(codes.map((code) => errorStatus[code]))
  return [...statuses].sort((left, right) => left - right)
}

/**
 * Field names of an object schema, or an empty map for anything else.
 *
 * Documented narrowing rather than a cast: only object schemas are ever passed
 * here, and a non-object simply contributes no named parameters.
 */
function shapeOf(schema: z.ZodTypeAny): Record<string, z.ZodTypeAny> {
  if (!(schema instanceof z.ZodObject)) return {}
  const shape = schema.shape as Record<string, z.ZodTypeAny>
  return shape
}

/**
 * Converts a zod schema to JSON Schema, hoisting named object schemas into
 * components so a type reused across endpoints is documented once.
 */
function toJsonSchema(schema: z.ZodTypeAny, io: 'input' | 'output'): Record<string, unknown> {
  const json = z.toJSONSchema(schema, {
    target: 'draft-2020-12',
    io,
    // Zod features with no JSON Schema equivalent are described rather than dropped.
    unrepresentable: 'any',
  }) as Record<string, unknown>

  // The dialect declaration belongs to a standalone schema document. Embedded in an
  // OpenAPI document it is redundant, and repeating it on every property is noise.
  const { $schema: _dialect, ...rest } = json
  return rest
}

/**
 * Converts a schema for embedding, hoisting any named sub-schemas into
 * `components` so a type reused across endpoints is documented exactly once.
 */
function dereference(
  schema: z.ZodTypeAny,
  io: 'input' | 'output',
  components?: Record<string, unknown>,
): Record<string, unknown> {
  const json = toJsonSchema(schema, io)
  if (components === undefined) return json

  const defs = json['$defs'] as Record<string, unknown> | undefined
  if (defs === undefined) return json

  for (const [key, value] of Object.entries(defs)) {
    components[key] ??= value
  }

  const { $defs: _hoisted, ...rest } = json
  return rest
}

/** Exposed for the specification's own tests: the status each code maps to. */
export const errorCodeStatus = errorStatus

/** Exposed for reference documentation that lists the codes by status. */
export function operationsByTag(): Record<string, Array<{ name: string; summary: string; method: HttpMethod }>> {
  const grouped: Record<string, Array<{ name: string; summary: string; method: HttpMethod }>> = {}
  for (const [name, spec] of Object.entries({ ...operations, ...streamingOperations })) {
    for (const tag of spec.tags) {
      grouped[tag] ??= []
      grouped[tag].push({ name, summary: spec.summary, method: spec.method })
    }
  }
  return grouped
}