import * as z from 'zod/v4'
import {
  accessTokenSchema,
  campaignSchema,
  campaignStatusSchema,
  chatMessageSchema,
  chatStreamEventSchema,
  chatThreadSchema,
  countrySpendSchema,
  createSegmentRequestSchema,
  createThreadRequestSchema,
  credentialsSchema,
  customerKpisSchema,
  customerPageSchema,
  customerSchema,
  generateCampaignRequestSchema,
  importCustomersRequestSchema,
  importCustomersResponseSchema,
  listCustomersQuerySchema,
  newCustomerSchema,
  refreshTokenSchema,
  searchQuerySchema,
  searchResponseSchema,
  segmentPreviewRequestSchema,
  segmentSchema,
  sendMessageRequestSchema,
  sendMessageResponseSchema,
  sessionSchema,
} from '../domains/index.js'
import { ApiError, type ErrorCode } from './problem.js'

export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE'

/**
 * Path-parameter schemas, shared by the operations that address one resource.
 *
 * Declaring them here is what lets the generated reference document describe
 * `:id` as a real parameter instead of an untyped string in the path.
 */
const resourceIdParams = z.object({ id: z.string().min(1) })
const threadIdParams = z.object({ threadId: z.string().min(1) })

/**
 * Structural shape every operation must have. Operations are declared with their
 * concrete zod schemas below, and the client derives both request and response
 * types from those schemas — a schema is the single source of truth, never the
 * hand-written TypeScript interface.
 */
export interface Operation {
  readonly method: HttpMethod
  readonly path: string
  readonly body?: z.ZodTypeAny
  readonly query?: z.ZodTypeAny
  /** Path parameters, keyed by the `:name` segments used in `path`. */
  readonly params?: z.ZodTypeAny
  readonly response: z.ZodTypeAny
  /** False only for the two operations that mint a token. */
  readonly auth: boolean
  /** One-line title, shown as the operation heading in the reference documentation. */
  readonly summary: string
  /** Behaviour notes: side effects, side conditions, caveats. */
  readonly description?: string
  /** Names the section this operation is grouped under. */
  readonly tags: readonly string[]
  /** Error codes this operation can answer with, beyond the implicit `internal_error`. */
  readonly errors?: readonly ErrorCode[]
  /**
   * True when the operation may safely be repeated with the same `Idempotency-Key`,
   * so a client retry after a transient failure returns the original result instead
   * of repeating the side effect.
   */
  readonly idempotent?: boolean
  /** Marks a superseded operation that still answers but must not be adopted. */
  readonly deprecated?: boolean
  /**
   * Date the operation stops answering, as an HTTP-date. Only meaningful
   * alongside `deprecated`, and published in the `Sunset` response header.
   */
  readonly sunset?: string
}

/**
 * The complete API surface. Adding an endpoint here makes it available on the
 * typed client, and the Nest controllers are validated against it by the e2e
 * suite — so a controller that drifts from this map fails the build.
 */
export const operations = {
  'auth.signIn': {
    method: 'POST',
    body: credentialsSchema,
    path: '/auth/sign-in',
    response: accessTokenSchema,
    auth: false,
    summary: 'Sign in with email and password',
    description:
      'Verifies the credentials, then mints an access/refresh pair. Refresh tokens are single-use: `auth.refresh` rotates them, so a token can only be exchanged once.',
    tags: ['Authentication'],
    errors: ['invalid_credentials', 'validation_failed'],
  },

  'auth.refresh': {
    method: 'POST',
    body: refreshTokenSchema,
    path: '/auth/refresh',
    response: sessionSchema,
    auth: false,
    summary: 'Exchange a refresh token for a new session',
    description:
      'Rotates the pair. The presented refresh token is revoked as part of the exchange, so replaying it is rejected as `session_expired`.',
    tags: ['Authentication'],
    errors: ['session_expired', 'validation_failed'],
  },

  'auth.signOut': {
    method: 'POST',
    body: refreshTokenSchema,
    path: '/auth/sign-out',
    response: z.null(),
    auth: true,
    summary: 'Revoke the current session',
    description:
      'Revokes the refresh token presented in the body. Idempotent: signing out twice is not an error. The access token stays usable until it expires, which keeps sign-out instantaneous.',
    tags: ['Authentication'],
    errors: [],
  },

  'customers.list': {
    method: 'GET',
    query: listCustomersQuerySchema,
    path: '/customers',
    response: customerPageSchema,
    auth: true,
    summary: 'List customers',
    description:
      'Paginated and filterable. Filtering, sorting and pagination all happen server-side, so a page never depends on how large the table is.',
    tags: ['Customers'],
    errors: [],
  },

  'customers.kpis': {
    method: 'GET',
    path: '/customers/kpis',
    response: customerKpisSchema,
    auth: true,
    summary: 'Customer KPIs',
    description:
      'Aggregate totals for the dashboard: headcount, active customers, lifetime value and average value.',
    tags: ['Customers'],
    errors: [],
  },

  'customers.create': {
    method: 'POST',
    body: newCustomerSchema,
    path: '/customers',
    response: customerSchema,
    auth: true,
    summary: 'Create a customer',
    description:
      'Adds one customer. A duplicate email is rejected with `conflict` rather than merged, so the caller decides what to do with it.',
    tags: ['Customers'],
    errors: ['conflict', 'validation_failed'],
  },

  'customers.import': {
    method: 'POST',
    body: importCustomersRequestSchema,
    path: '/customers/import',
    response: importCustomersResponseSchema,
    auth: true,
    summary: 'Import customers in bulk',
    description:
      'Partial import: valid rows are persisted and invalid ones are reported per row, so one bad line does not fail the whole file. `row` is the 1-based position within `customers`.',
    tags: ['Customers'],
    errors: ['validation_failed'],
  },

  'countries.list': {
    method: 'GET',
    path: '/countries',
    response: z.array(z.string()),
    auth: true,
    summary: 'List known countries',
    description:
      'Distinct countries present in the customer base, sorted alphabetically.',
    tags: ['Customers'],
    errors: [],
  },

  'countries.spend': {
    method: 'GET',
    path: '/countries/spend',
    response: z.array(countrySpendSchema),
    auth: true,
    summary: 'Spend grouped by country',
    description:
      'Total spend per country, ordered by amount so a dashboard can render a ranking without sorting client-side.',
    tags: ['Customers'],
    errors: [],
  },

  'segments.list': {
    method: 'GET',
    path: '/segments',
    response: z.array(segmentSchema),
    auth: true,
    summary: 'List saved segments',
    description:
      'Returns saved segments with their stored conditions and last known audience size.',
    tags: ['Segments'],
    errors: [],
  },

  'segments.create': {
    method: 'POST',
    body: createSegmentRequestSchema,
    path: '/segments',
    response: segmentSchema,
    auth: true,
    summary: 'Save a segment',
    description:
      'Conditions are combined with AND. Clauses keep the order they were written in so a saved segment stays readable.',
    tags: ['Segments'],
    errors: ['validation_failed'],
  },

  'segments.delete': {
    method: 'DELETE',
    params: resourceIdParams,
    path: '/segments/:id',
    response: z.null(),
    auth: true,
    summary: 'Delete a segment',
    description:
      'Removes the segment. Campaigns generated from it keep their stored copy of the segment name, so history stays readable.',
    tags: ['Segments'],
    errors: ['not_found'],
  },

  'segments.preview': {
    method: 'POST',
    body: segmentPreviewRequestSchema,
    path: '/segments/preview',
    response: z.object({ matchCount: z.number().int().min(0) }),
    auth: true,
    summary: 'Preview a segment audience',
    description:
      'Counts the customers matching unsaved conditions. Use it while building, before committing a segment.',
    tags: ['Segments'],
    errors: ['validation_failed'],
  },

  'campaigns.list': {
    method: 'GET',
    path: '/campaigns',
    response: z.array(campaignSchema),
    auth: true,
    summary: 'List generated campaigns',
    description:
      'Newest first.',
    tags: ['Campaigns'],
    errors: [],
  },

  'campaigns.generate': {
    method: 'POST',
    body: generateCampaignRequestSchema,
    path: '/campaigns/generate',
    response: campaignSchema,
    auth: true,
    summary: 'Generate a campaign',
    description:
      'Runs the configured language model over a saved segment and returns a drafted campaign. Generation is a server concern: the browser never talks to the model provider. Send an `Idempotency-Key` header to make the call safe to retry: the first response is recorded against the key, a repeat returns it with `Idempotency-Replayed: true` instead of generating a second campaign, and reusing a key for a different body is rejected with `conflict`.',
    tags: ['Campaigns'],
    errors: ['not_found', 'llm_unavailable', 'llm_error', 'validation_failed', 'conflict'],
    idempotent: true,
  },

  'campaigns.updateStatus': {
    method: 'PATCH',
    params: resourceIdParams,
    body: z.object({ status: campaignStatusSchema }),
    path: '/campaigns/:id/status',
    response: campaignSchema,
    auth: true,
    summary: 'Change a campaign status',
    description:
      'Legal transitions are `draft` to `ready` to `sent`, plus `ready` back to `draft`. Anything else is rejected with `conflict`.',
    tags: ['Campaigns'],
    errors: ['not_found', 'conflict', 'validation_failed'],
  },

  'campaigns.delete': {
    method: 'DELETE',
    params: resourceIdParams,
    path: '/campaigns/:id',
    response: z.null(),
    auth: true,
    summary: 'Delete a campaign',
    description:
      'Removes the campaign.',
    tags: ['Campaigns'],
    errors: ['not_found'],
  },

  'chat.threads.list': {
    method: 'GET',
    path: '/chat/threads',
    response: z.array(chatThreadSchema),
    auth: true,
    summary: 'List chat threads',
    description:
      'Newest first, with the message count of each thread.',
    tags: ['Chat'],
    errors: [],
  },

  'chat.threads.create': {
    method: 'POST',
    body: createThreadRequestSchema,
    path: '/chat/threads',
    response: chatThreadSchema,
    auth: true,
    summary: 'Start a chat thread',
    description:
      'Creates an empty thread. The title is derived from the first message once one exists.',
    tags: ['Chat'],
    errors: [],
  },

  'chat.threads.delete': {
    method: 'DELETE',
    params: resourceIdParams,
    path: '/chat/threads/:id',
    response: z.null(),
    auth: true,
    summary: 'Delete a chat thread',
    description:
      'Removes the thread and its messages.',
    tags: ['Chat'],
    errors: ['not_found'],
  },

  'chat.messages.list': {
    method: 'GET',
    params: threadIdParams,
    path: '/chat/threads/:threadId/messages',
    response: z.array(chatMessageSchema),
    auth: true,
    summary: 'List thread messages',
    description:
      'Oldest first, so a client can render the transcript in order.',
    tags: ['Chat'],
    errors: ['not_found'],
  },

  'chat.messages.send': {
    method: 'POST',
    params: threadIdParams,
    body: sendMessageRequestSchema,
    path: '/chat/threads/:threadId/messages',
    response: sendMessageResponseSchema,
    auth: true,
    summary: 'Send a message and wait for the reply',
    description:
      'Non-streaming counterpart of `chat.messages.stream`: one request, one complete assistant message.',
    tags: ['Chat'],
    errors: ['not_found', 'llm_unavailable', 'llm_error'],
  },

  'search.global': {
    method: 'GET',
    query: searchQuerySchema,
    path: '/search',
    response: searchResponseSchema,
    auth: true,
    summary: 'Search across customers, segments and campaigns',
    description:
      'Relevance-ranked, fuzzy. A query may match a substring, a word prefix or (for three or more characters) a trigram-similar phrase; the signal is accent-insensitive, so typography cannot hide a match. Results mix all three record types sorted by score, which the palette mirrors as grouped sections. Every result answers with a `score`, the client-facing rank, never with an SQL value.',
    tags: ['Search'],
    errors: [],
  },
} as const satisfies Record<string, Operation>

/** Operations that answer with server-sent events rather than one JSON body. */
export const streamingOperations = {
  'chat.messages.stream': {
    method: 'POST',
    params: threadIdParams,
    path: '/chat/threads/:threadId/messages/stream',
    body: sendMessageRequestSchema,
    event: chatStreamEventSchema,
    auth: true,
    summary: 'Send a message and stream the reply',
    description:
      'Server-sent events. Frames are `start`, then one `delta` per chunk, then a terminal `done` or `error`. The request stays open for the whole reply, so a proxy in front of the API must not buffer it.',
    tags: ['Chat'],
    errors: ['not_found', 'llm_unavailable', 'llm_error'],
  },
} as const satisfies Record<string, Omit<Operation, 'response'> & { event: z.ZodTypeAny }>

export type Api = typeof operations
export type StreamingApi = typeof streamingOperations

export type OperationName = keyof Api
export type StreamName = keyof StreamingApi

/** Request body as the caller writes it (pre-validation input). */
export type BodyOf<TName extends OperationName> = Api[TName] extends { body: z.ZodTypeAny }
  ? z.input<Api[TName]['body']>
  : undefined

export type QueryOf<TName extends OperationName> = Api[TName] extends { query: z.ZodTypeAny }
  ? z.input<Api[TName]['query']>
  : undefined

/** Response as the caller reads it (post-validation output). */
export type ResultOf<TName extends OperationName> = z.output<Api[TName]['response']>

export type StreamBodyOf<TName extends StreamName> = StreamingApi[TName] extends { body: z.ZodTypeAny }
  ? z.input<StreamingApi[TName]['body']>
  : undefined

export type StreamEventOf<TName extends StreamName> = z.output<StreamingApi[TName]['event']>

export interface CallOptions<TName extends OperationName> {
  params?: Record<string, string>
  body?: BodyOf<TName>
  query?: QueryOf<TName>
  signal?: AbortSignal
  /**
   * Sent as `Idempotency-Key`, letting a retry of this exact call return the first
   * response instead of repeating the side effect. Reuse the same value for every
   * attempt of one logical request, and a new one for each distinct request.
   */
  idempotencyKey?: string
}

export interface StreamOptions<TName extends StreamName> {
  params?: Record<string, string>
  body?: StreamBodyOf<TName>
  signal?: AbortSignal
}

export { ApiError, type ErrorCode }