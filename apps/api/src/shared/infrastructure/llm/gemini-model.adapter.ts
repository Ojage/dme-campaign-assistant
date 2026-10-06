import { Inject, Injectable, Logger } from '@nestjs/common'
import type * as z from 'zod/v4'
import { ENV } from '../../../config/env'
import type { AppConfig } from '../../../config/env'
import type {
  TextGenerationRequest,
  TextGenerationResult,
  TextModel,
} from '../../application/ports/text-model.port'
import type {
  StructuredGenerationRequest,
  StructuredGenerationResult,
  StructuredModel,
} from '../../application/ports/structured-model.port'
import { OpenAiCompatibleClient } from './openai-compatible.client'

/**
 * Injectable shell around `OpenAiCompatibleClient`, pointed at Gemini.
 *
 * Gemini exposes the same OpenAI-compatible `/chat/completions` route as OpenCode
 * Zen, so the shared client carries the wire format and `GEMINI_BASE_URL` decides
 * which gateway it lands on. Like its sibling, this shell exists only so Nest can
 * build the client from configuration; both ports are satisfied by the same object.
 */
@Injectable()
export class GeminiModelAdapter implements TextModel, StructuredModel {
  readonly #client: OpenAiCompatibleClient

  public constructor(@Inject(ENV) config: AppConfig) {
    this.#client = new OpenAiCompatibleClient({ ...config.gemini, label: 'Gemini' }, new Logger(GeminiModelAdapter.name))
  }

  public get modelId(): string {
    return this.#client.modelId
  }

  public generate(request: TextGenerationRequest): Promise<TextGenerationResult> {
    return this.#client.generate(request)
  }

  public stream(request: TextGenerationRequest): AsyncGenerator<string, void, undefined> {
    return this.#client.stream(request)
  }

  public generateStructured<TSchema extends z.ZodTypeAny>(
    request: StructuredGenerationRequest<TSchema>,
  ): Promise<StructuredGenerationResult<z.output<TSchema>>> {
    return this.#client.generateStructured(request)
  }
}