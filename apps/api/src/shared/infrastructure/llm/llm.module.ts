import { Global, Module } from '@nestjs/common'
import { ENV } from '../../../config/env'
import type { AppConfig } from '../../../config/env'
import { STRUCTURED_MODEL } from '../../application/ports/structured-model.port'
import { TEXT_MODEL } from '../../application/ports/text-model.port'
import { AnthropicModelAdapter } from './anthropic-model.adapter'
import { ScriptedModelAdapter } from './scripted-model.adapter'

/**
 * Binds the model ports.
 *
 * The choice between the hosted provider and the offline stand-in is made once,
 * here, from configuration. Nothing in the campaigns or chat modules knows which
 * adapter it received.
 */
@Global()
@Module({
  providers: [
    AnthropicModelAdapter,
    ScriptedModelAdapter,
    {
      provide: TEXT_MODEL,
      inject: [ENV, AnthropicModelAdapter, ScriptedModelAdapter],
      useFactory: (
        config: AppConfig,
        anthropic: AnthropicModelAdapter,
        scripted: ScriptedModelAdapter,
      ) => (config.anthropic.enabled ? anthropic : scripted),
    },
    {
      provide: STRUCTURED_MODEL,
      inject: [ENV, AnthropicModelAdapter, ScriptedModelAdapter],
      useFactory: (
        config: AppConfig,
        anthropic: AnthropicModelAdapter,
        scripted: ScriptedModelAdapter,
      ) => (config.anthropic.enabled ? anthropic : scripted),
    },
  ],
  exports: [TEXT_MODEL, STRUCTURED_MODEL],
})
export class LlmModule {}

/** Lets `main.ts` report which adapter is live at boot. */
export function describeLlmMode(config: AppConfig): string {
  return config.anthropic.enabled
    ? `Anthropic (${config.anthropic.model})`
    : 'scripted local model (set ANTHROPIC_API_KEY to enable Claude)'
}