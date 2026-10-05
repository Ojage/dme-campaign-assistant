import { Global, Module } from '@nestjs/common'
import { ENV } from '../../../config/env'
import type { AppConfig } from '../../../config/env'
import { STRUCTURED_MODEL } from '../../application/ports/structured-model.port'
import { TEXT_MODEL } from '../../application/ports/text-model.port'
import { AnthropicModelAdapter } from './anthropic-model.adapter'
import { selectAdapters } from './llm-selection'
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
    ScriptedModelAdapter,
    {
      provide: TEXT_MODEL,
      inject: [ENV, AnthropicModelAdapter, OpenCodeModelAdapter, ScriptedModelAdapter],
      useFactory: (
        config: AppConfig,
        anthropic: AnthropicModelAdapter,
        opencode: OpenCodeModelAdapter,
        scripted: ScriptedModelAdapter,
      ) => selectAdapters(config, { anthropic, opencode, scripted }),
    },
    {
      provide: STRUCTURED_MODEL,
      inject: [ENV, AnthropicModelAdapter, OpenCodeModelAdapter, ScriptedModelAdapter],
      useFactory: (
        config: AppConfig,
        anthropic: AnthropicModelAdapter,
        opencode: OpenCodeModelAdapter,
        scripted: ScriptedModelAdapter,
      ) => selectAdapters(config, { anthropic, opencode, scripted }),
    },
  ],
  exports: [TEXT_MODEL, STRUCTURED_MODEL],
})
export class LlmModule {}