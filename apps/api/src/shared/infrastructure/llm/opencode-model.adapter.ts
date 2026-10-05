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
import { OpenCodeGatewayClient } from './opencode-gateway.client'

/**
 * Injectable shell around `OpenCodeGatewayClient`.
 *
 * The shell exists only so Nest can build the client from configuration; every
 * behaviour lives in the client, which imports no framework code and is therefore
 * testable without booting Nest. Both ports are satisfied by the same object, so
 * chat text, campaign structure and streaming all come from one provider.
 */
@Injectable()
export class OpenCodeModelAdapter implements TextModel, StructuredModel {
  readonly #client: OpenCodeGatewayClient

  public constructor(@Inject(ENV) config: AppConfig) {
    this.#client = new OpenCodeGatewayClient(config.opencode, new Logger(OpenCodeModelAdapter.name))
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