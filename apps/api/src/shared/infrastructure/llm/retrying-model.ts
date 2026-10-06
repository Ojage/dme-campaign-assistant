import type {
  StructuredGenerationRequest,
  StructuredGenerationResult,
  StructuredModel,
} from '../../application/ports/structured-model.port'
import type {
  TextGenerationRequest,
  TextGenerationResult,
  TextModel,
} from '../../application/ports/text-model.port'
import type * as z from 'zod/v4'
import { backoffDelayMs, canRetry, withRetry } from './retry'
import type { RetryPolicy } from './retry'

/**
 * Retries transient provider faults against one fixed inner model.
 *
 * A decorator rather than logic inside each adapter, so Anthropic and OpenCode Zen
 * get identical behaviour and neither can drift into its own policy.
 *
 * Streaming is the subtle case. Retrying mid-stream would replay text the browser
 * has already rendered, so a stream is only retried while it has produced nothing
 * at all. Once a delta has been yielded the failure is the caller's to see.
 */
export class RetryingModel implements TextModel, StructuredModel {
  public readonly modelId: string

  public constructor(
    private readonly inner: TextModel & StructuredModel,
    private readonly policy: RetryPolicy,
  ) {
    this.modelId = inner.modelId
  }

  /**
   * A buffered call is safe to repeat: nothing has reached the caller, and for
   * campaign generation the model call happens before anything is saved.
   */
  public generate(request: TextGenerationRequest): Promise<TextGenerationResult> {
    return withRetry(this.policy, request.signal, () => this.inner.generate(request))
  }

  public generateStructured<TSchema extends z.ZodTypeAny>(
    request: StructuredGenerationRequest<TSchema>,
  ): Promise<StructuredGenerationResult<z.output<TSchema>>> {
    return withRetry(this.policy, request.signal, () => this.inner.generateStructured(request))
  }

  public async *stream(request: TextGenerationRequest): AsyncGenerator<string, void, undefined> {
    let emitted = false
    for (let attemptsMade = 1; ; attemptsMade += 1) {
      try {
        for await (const delta of this.inner.stream(request)) {
          emitted = true
          yield delta
        }
        return
      } catch (error) {
        if (emitted || !canRetry(this.policy, attemptsMade, error, request.signal)) throw error
        await this.policy.sleep(backoffDelayMs(this.policy, attemptsMade - 1), request.signal)
      }
    }
  }
}