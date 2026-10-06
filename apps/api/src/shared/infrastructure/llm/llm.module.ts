import { Global, Module } from '@nestjs/common'
import { ENV } from '../../../config/env'
import type { AppConfig } from '../../../config/env'
import { STRUCTURED_MODEL } from '../../application/ports/structured-model.port'
import { TEXT_MODEL } from '../../application/ports/text-model.port'
import { AnthropicModelAdapter } from './anthropic-model.adapter'
import { GeminiModelAdapter } from './gemini-model.adapter'
import { selectAdapters, SELECTED_MODEL } from './llm-selection'
import { OpenCodeModelAdapter } from './opencode-model.adapter'
import { ScriptedModelAdapter } from './scripted-model.adapter'

/**
 * Binds the model ports.
 *
 * The choice between the hosted providers and the offline stand-in is made once,
 * here, from configuration. Nothing in the campaigns or chat modules knows which
 * adapter it received.
 */
@Global()
@Module({
  providers: [
    AnthropicModelAdapter,
    OpenCodeModelAdapter,
    GeminiModelAdapter,
    ScriptedModelAdapter,
    {
      provide: SELECTED_MODEL,
      inject: [ENV, AnthropicModelAdapter, OpenCodeModelAdapter, GeminiModelAdapter, ScriptedModelAdapter],
      useFactory: (
        config: AppConfig,
        anthropic: AnthropicModelAdapter,
        opencode: OpenCodeModelAdapter,
        gemini: GeminiModelAdapter,
        scripted: ScriptedModelAdapter,
      ) => selectAdapters(config, { anthropic, opencode, gemini, scripted }),
    },
    // Aliased rather than built twice, so both ports hold the same adapter object
    // and therefore the same retry state.
    { provide: TEXT_MODEL, useExisting: SELECTED_MODEL },
    { provide: STRUCTURED_MODEL, useExisting: SELECTED_MODEL },
  ],
  exports: [TEXT_MODEL, STRUCTURED_MODEL],
})
export class LlmModule {}