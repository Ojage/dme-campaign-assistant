import * as z from 'zod/v4'
import { ModelProviderError } from '../../domain/domain.errors'
import type {
  ModelTurn,
  TextGenerationRequest,
  TextGenerationResult,
  TextModel,
} from '../../application/ports/text-model.port'
import type {
  StructuredGenerationRequest,
  StructuredGenerationResult,
  StructuredModel,
} from '../../application/ports/structured-model.port'

/** The slice of `AppConfig['opencode']` the gateway needs. */
export interface OpenCodeGatewaySettings {
  readonly apiKey: string
  readonly baseUrl: string
  readonly model: string
  readonly maxTokens: number
}

/** The one thing this needs from Nest's logger, kept as an interface so the module stays framework-free. */
export interface LogSink {
  error(message: string): void
}

/**
 * OpenCode Zen, over its OpenAI-compatible `/chat/completions` route.
 *
 * Zen fronts several vendors behind one key, and the model id decides which route
 * is live — GPT and Grok live under `/responses`, Claude and Qwen under `/messages`.
 * This targets `/chat/completions` only, because that family is the widest (GLM,
 * Kimi, DeepSeek, MiniMax, Qwen Max) and because its `response_format` and SSE
 * framing are the ones this codebase can rely on uniformly. `baseUrl` therefore
 * stays configurable: any other OpenAI-compatible gateway works unchanged.
 *
 * `fetch` is used directly rather than an SDK, so the gateway needs no new
 * dependency, and the caller's `AbortSignal` can be passed straight through — a
 * client closing the chat stream really does cancel the upstream request.
 *
 * This holds no Nest decorator and imports nothing from the framework, so the wire
 * format and the error mapping can be tested directly; `OpenCodeModelAdapter` is
 * only the injectable shell around it.
 */
export class OpenCodeGatewayClient implements TextModel, StructuredModel {
  public readonly modelId: string
  readonly #endpoint: string
  readonly #apiKey: string
  readonly #maxTokens: number
  readonly #log: LogSink

  public constructor(settings: OpenCodeGatewaySettings, log: LogSink) {
    this.#endpoint = `${settings.baseUrl}/chat/completions`
    this.#apiKey = settings.apiKey
    this.modelId = settings.model
    this.#maxTokens = settings.maxTokens
    this.#log = log
  }

  public async generate(request: TextGenerationRequest): Promise<TextGenerationResult> {
    const body = await this.#send(
      {
        model: this.modelId,
        messages: toMessages(request.system, request.turns),
        max_tokens: request.maxTokens ?? this.#maxTokens,
        ...(request.temperature === undefined ? {} : { temperature: request.temperature }),
      },
      request.signal,
    )

    return { text: readContent(body), model: readModel(body, this.modelId) }
  }

  public async *stream(request: TextGenerationRequest): AsyncGenerator<string, void, undefined> {
    const response = await this.#open(
      {
        model: this.modelId,
        messages: toMessages(request.system, request.turns),
        max_tokens: request.maxTokens ?? this.#maxTokens,
        stream: true,
      },
      request.signal,
    )

    if (!response.ok) {
      throw this.#toDomainError(response.status, await response.text())
    }
    for await (const delta of readDeltas(response)) {
      yield delta
    }
  }

  /**
   * The schema travels as a JSON Schema `response_format`, and the answer is
   * re-validated through the same zod schema afterwards. The gateway is asked to
   * constrain the shape but is not trusted to have done so — a model can still
   * return prose or a truncated object, and the port promises the output satisfies
   * the schema.
   */
  public async generateStructured<TSchema extends z.ZodTypeAny>(
    request: StructuredGenerationRequest<TSchema>,
  ): Promise<StructuredGenerationResult<z.output<TSchema>>> {
    const body = await this.#send(
      {
        model: this.modelId,
        messages: toMessages(request.system, request.turns),
        max_tokens: request.maxTokens ?? this.#maxTokens,
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'structured_response',
            strict: true,
            schema: toJsonSchema(request.schema),
          },
        },
      },
      request.signal,
    )

    const parsedJson = parseJson(readContent(body))
    const parsed = request.schema.safeParse(parsedJson)
    if (!parsed.success) {
      this.#log.error(`OpenCode returned JSON that does not satisfy the schema: ${parsed.error.message}`)
      throw new ModelProviderError('The content model returned a malformed response.', 'llm_error')
    }
    return { data: parsed.data as z.output<TSchema>, model: readModel(body, this.modelId) }
  }

  /** Non-streaming call: throws on a non-2xx, returns the parsed envelope. */
  async #send(body: unknown, signal?: AbortSignal): Promise<GatewayResponse> {
    const response = await this.#open(body, signal)
    const text = await response.text()
    if (!response.ok) throw this.#toDomainError(response.status, text)
    try {
      return JSON.parse(text) as GatewayResponse
    } catch (cause) {
      throw new ModelProviderError('The content model returned an unreadable response.', 'llm_error', { cause })
    }
  }

  async #open(body: unknown, signal?: AbortSignal): Promise<Response> {
    try {
      return await fetch(this.#endpoint, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${this.#apiKey}`,
          'content-type': 'application/json',
          accept: 'application/json',
        },
        body: JSON.stringify(body),
        ...(signal === undefined ? {} : { signal }),
      })
    } catch (cause) {
      throw this.#toDomainError(undefined, undefined, cause)
    }
  }

  /**
   * Provider faults become domain errors. The key is never echoed back: the log
   * keeps a truncated body, and the client-facing message carries neither.
   */
  #toDomainError(status: number | undefined, body?: string, cause?: unknown): ModelProviderError {
    if (cause instanceof ModelProviderError) return cause
    this.#log.error(`OpenCode request failed: ${body === undefined ? String(cause) : `HTTP ${String(status)} ${body.slice(0, 300)}`}`)

    // A cancelled request is the caller's doing, not an outage, so it must not be
    // reported as retryable.
    if (cause instanceof Error && cause.name === 'AbortError') {
      return new ModelProviderError('The request was cancelled.', 'llm_error', { cause })
    }
    if (status === 401 || status === 403) {
      return new ModelProviderError('The content model rejected the configured credentials.', 'llm_error', { cause })
    }
    const retryable = status === undefined || status === 429 || status >= 500
    return new ModelProviderError(
      retryable
        ? 'The content model is temporarily unavailable. Try again shortly.'
        : 'The content model rejected the request.',
      retryable ? 'llm_unavailable' : 'llm_error',
      { cause },
    )
  }
}

/** The subset of the chat-completions envelope this client reads. */
interface GatewayResponse {
  readonly model?: string
  readonly choices?: readonly { readonly message?: { readonly content?: string | null } }[]
}

function toMessages(system: string, turns: readonly ModelTurn[]): { role: string; content: string }[] {
  return [
    { role: 'system', content: system },
    ...turns.map((turn) => ({ role: turn.role, content: turn.content })),
  ]
}

function readContent(body: GatewayResponse): string {
  const content = body.choices?.[0]?.message?.content
  return typeof content === 'string' ? content : ''
}

/** The gateway echoes the resolved model, which is worth reporting when an alias landed elsewhere. */
function readModel(body: GatewayResponse, fallback: string): string {
  return typeof body.model === 'string' && body.model.length > 0 ? body.model : fallback
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw)
  } catch (cause) {
    throw new ModelProviderError('The content model returned a malformed response.', 'llm_error', { cause })
  }
}

/**
 * `zod/v4` emits `$schema`, which OpenAI-compatible gateways reject as an unknown
 * keyword, so it is stripped. The rest of the output already carries
 * `additionalProperties: false` and a complete `required` list, which strict mode
 * also demands.
 */
function toJsonSchema(schema: z.ZodTypeAny): Record<string, unknown> {
  const { $schema: _ignored, ...rest } = z.toJSONSchema(schema) as Record<string, unknown>
  return rest
}

/** Marks the stream terminator, which ends the stream even if the socket stays open. */
const DONE = Symbol('stream-done')

/**
 * Yields the text of each SSE frame.
 *
 * Frames are separated by a blank line, but a gateway may split one anywhere, so
 * the buffer is only consumed up to the last complete boundary and the remainder
 * is carried into the next read.
 */
async function* readDeltas(response: Response): AsyncGenerator<string, void, undefined> {
  if (response.body === null) {
    throw new ModelProviderError('The content model returned an empty stream.', 'llm_error')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let exhausted = false
  try {
    while (!exhausted) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      let boundary = buffer.indexOf('\n\n')
      while (boundary !== -1) {
        const frame = buffer.slice(0, boundary)
        buffer = buffer.slice(boundary + 2)
        const delta = readDelta(frame)
        if (delta === DONE) {
          exhausted = true
          break
        }
        if (delta !== undefined) yield delta
        boundary = buffer.indexOf('\n\n')
      }
    }
  } finally {
    // Either the terminator arrived or the consumer walked away, and in both cases
    // the body can still hold unread frames. Cancelling drops them and releases the
    // socket, which is the whole reason for stopping at the terminator instead of
    // waiting for the gateway to close.
    await reader.cancel().catch(() => undefined)
    reader.releaseLock()
  }
}

function readDelta(frame: string): string | typeof DONE | undefined {
  for (const line of frame.split('\n')) {
    if (!line.startsWith('data:')) continue
    const payload = line.slice('data:'.length).trim()
    if (payload.length === 0) continue
    // The stream terminator is a bare sentinel, not JSON.
    if (payload === '[DONE]') return DONE
    try {
      const chunk = JSON.parse(payload) as {
        choices?: readonly { delta?: { content?: string | null } }[]
      }
      const content = chunk.choices?.[0]?.delta?.content
      if (typeof content === 'string' && content.length > 0) return content
    } catch {
      // A frame the gateway annotated rather than sent as JSON carries no text.
    }
  }
  return undefined
}