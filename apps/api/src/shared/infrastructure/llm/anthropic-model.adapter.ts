import { Inject, Injectable, Logger } from '@nestjs/common'
import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import type * as z from 'zod/v4'
import { ENV } from '../../../config/env'
import type { AppConfig } from '../../../config/env'
import { ModelProviderError } from '../../domain/domain.errors'
import { isAbortError } from './abort'
import { describeException } from './error-description'
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

/** Turns the port's turns into the SDK's message shape. */
function toMessages(turns: readonly ModelTurn[]): Anthropic.MessageParam[] {
  return turns.map((turn) => ({ role: turn.role, content: turn.content }))
}

/** Concatenates the text blocks of a completed message. */
function readText(content: Anthropic.ContentBlock[]): string {
  return content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('')
}

/**
 * Anthropic adapter. This is the only file in the codebase that imports the
 * vendor SDK, so switching or adding a provider is a change to this class plus one
 * line in `LlmModule`.
 *
 * It satisfies both model ports: plain text and schema-validated JSON, the latter
 * using the SDK's structured-output helper so the response is validated against
 * the same zod schema the API already trusts.
 */
@Injectable()
export class AnthropicModelAdapter implements TextModel, StructuredModel {
  public readonly modelId: string
  readonly #client: Anthropic
  readonly #maxTokens: number
  readonly #logger = new Logger(AnthropicModelAdapter.name)

  public constructor(@Inject(ENV) config: AppConfig) {
    // `maxRetries: 0` is load-bearing: the SDK retries 429/5xx twice on its own by
    // default, and the `RetryingModel` decorator owns that policy now. Leaving the
    // SDK's loop on would nest two policies and multiply the real attempts by three.
    this.#client = new Anthropic({
      apiKey: config.anthropic.apiKey,
      timeout: config.anthropic.timeoutMs,
      maxRetries: 0,
    })
    this.modelId = config.anthropic.model
    this.#maxTokens = config.anthropic.maxTokens
  }

  public async generate(request: TextGenerationRequest): Promise<TextGenerationResult> {
    try {
      const message = await this.#client.messages.create(
        {
          model: this.modelId,
          max_tokens: request.maxTokens ?? this.#maxTokens,
          ...(request.temperature === undefined ? {} : { temperature: request.temperature }),
          system: request.system,
          messages: toMessages(request.turns),
        },
        requestOptions(request.signal),
      )
      return { text: readText(message.content), model: message.model }
    } catch (cause) {
      throw this.#toDomainError(cause)
    }
  }

  public async *stream(request: TextGenerationRequest): AsyncGenerator<string, void, undefined> {
    try {
      const stream = await this.#client.messages.create(
        {
          model: this.modelId,
          max_tokens: request.maxTokens ?? this.#maxTokens,
          system: request.system,
          messages: toMessages(request.turns),
          stream: true,
        },
        requestOptions(request.signal),
      )

      for await (const event of stream) {
        // Only text deltas matter here; thinking and tool blocks are ignored.
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          yield event.delta.text
        }
      }
    } catch (cause) {
      throw this.#toDomainError(cause)
    }
  }

  public async generateStructured<TSchema extends z.ZodTypeAny>(
    request: StructuredGenerationRequest<TSchema>,
  ): Promise<StructuredGenerationResult<z.output<TSchema>>> {
    try {
      const parsed = await this.#client.messages.parse(
        {
          model: this.modelId,
          max_tokens: request.maxTokens ?? this.#maxTokens,
          system: request.system,
          messages: toMessages(request.turns),
          output_config: { format: zodOutputFormat(request.schema) },
        },
        requestOptions(request.signal),
      )
      return { data: parsed.parsed_output as z.output<TSchema>, model: parsed.model }
    } catch (cause) {
      throw this.#toDomainError(cause)
    }
  }

  /** Provider faults become domain errors; credentials never leak into a response. */
  #toDomainError(cause: unknown): ModelProviderError {
    if (cause instanceof ModelProviderError) return cause
    const status = cause instanceof Anthropic.APIError ? cause.status : undefined
    this.#logger.error(`Anthropic request failed: ${describeException(cause)}`)

    // The SDK reports a caller cancellation as a generic connection error, so the
    // caller signal is checked first: retrying a cancelled request is pointless
    // and would defeat the abort that let the browser leave.
    if (isAbortError(cause)) {
      return new ModelProviderError('The request was cancelled.', 'llm_error', { cause })
    }
    if (cause instanceof Anthropic.APIConnectionTimeoutError) {
      return new ModelProviderError('The content model did not respond in time.', 'llm_unavailable', { cause })
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

/**
 * The SDK takes cancellation as a request option, not a message field; sending `signal`
 * in the body makes Anthropic reject the whole request with "signal: Extra inputs are
 * not permitted".
 */
function requestOptions(signal: AbortSignal | undefined): { signal?: AbortSignal | undefined } {
  return signal === undefined ? {} : { signal }
}
