import type { AppConfig, ResolvedModelProvider } from '../../../config/env'
import type { StructuredModel } from '../../application/ports/structured-model.port'
import type { TextModel } from '../../application/ports/text-model.port'

/**
 * Which adapter the model ports get, and how to say so at boot.
 *
 * Kept apart from `LlmModule` so the decision can be exercised without Nest: the
 * provider is configuration, and so is the log line that explains it.
 */

/** The adapters `LlmModule` can bind. Each satisfies both ports. */
export interface AdapterSet {
  readonly anthropic: TextModel & StructuredModel
  readonly opencode: TextModel & StructuredModel
  readonly scripted: TextModel & StructuredModel
}

/** One lookup serves both ports, because every adapter provides both capabilities. */
export function selectAdapters(config: AppConfig, adapters: AdapterSet): TextModel & StructuredModel {
  switch (config.modelProvider) {
    case 'anthropic':
      return adapters.anthropic
    case 'opencode':
      return adapters.opencode
    case 'scripted':
      return adapters.scripted
  }
}

/**
 * Names the live adapter for the boot log.
 *
 * When `MODEL_PROVIDER` asked for a provider whose key is missing, `modelProvider`
 * has already resolved to `scripted`; naming the missing key is the difference
 * between a puzzling "why is my model dumb" report and an obvious misconfiguration.
 */
export function describeLlmMode(config: AppConfig): string {
  const live = describeProvider(config.modelProvider, config)
  if (config.requestedModelProvider !== 'auto' && config.requestedModelProvider !== config.modelProvider) {
    const needed = config.requestedModelProvider === 'anthropic' ? 'ANTHROPIC_API_KEY' : 'OPENCODE_API_KEY'
    return `${live} — MODEL_PROVIDER=${config.requestedModelProvider} was requested but ${needed} is not set`
  }
  if (config.modelProvider === 'scripted') {
    return `${live} — set ANTHROPIC_API_KEY or OPENCODE_API_KEY to enable a hosted model`
  }
  return live
}

function describeProvider(provider: ResolvedModelProvider, config: AppConfig): string {
  switch (provider) {
    case 'anthropic':
      return `Anthropic (${config.anthropic.model})`
    case 'opencode':
      return `OpenCode Zen (${config.opencode.model} via ${config.opencode.baseUrl})`
    case 'scripted':
      return 'scripted local model'
  }
}