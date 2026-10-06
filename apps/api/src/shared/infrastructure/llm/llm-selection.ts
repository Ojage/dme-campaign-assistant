import type { AppConfig, ResolvedModelProvider } from '../../../config/env'
import type { StructuredModel } from '../../application/ports/structured-model.port'
import type { TextModel } from '../../application/ports/text-model.port'
import { defaultRetryPolicy } from './retry'
import { RetryingModel } from './retrying-model'

/**
 * Which adapter the model ports get, and how to say so at boot.
 *
 * Kept apart from `LlmModule` so the decision can be exercised without Nest: the
 * provider is configuration, and so is the log line that explains it.
 */

/** The adapters `LlmModule` can bind. Each satisfies both ports. */
export interface AdapterSet {
  readonly opencode: TextModel & StructuredModel
  readonly gemini: TextModel & StructuredModel
  readonly anthropic: TextModel & StructuredModel
  readonly scripted: TextModel & StructuredModel
}

/**
 * The single adapter instance both model ports resolve to.
 *
 * `TEXT_MODEL` and `STRUCTURED_MODEL` alias this rather than each building one, so
 * chat text and campaign structure are provably served by the same object.
 */
export const SELECTED_MODEL = Symbol('SELECTED_MODEL')

/**
 * One lookup serves both ports, because every adapter provides both capabilities.
 *
 * The chosen adapter is wrapped in `RetryingModel`, so the retry policy is
 * declared once and applies identically no matter which provider is live — and no
 * provider is ever swapped in behind a failed call.
 */
export function selectAdapters(config: AppConfig, adapters: AdapterSet): TextModel & StructuredModel {
  const policy = defaultRetryPolicy(config.retry)
  switch (config.modelProvider) {
    case 'opencode':
      return new RetryingModel(adapters.opencode, policy)
    case 'gemini':
      return new RetryingModel(adapters.gemini, policy)
    case 'anthropic':
      return new RetryingModel(adapters.anthropic, policy)
    case 'scripted':
      return new RetryingModel(adapters.scripted, policy)
  }
}

/** Maps a provider to the env variable that enables it, for mismatch reporting. */
const PROVIDER_KEY: Record<ResolvedModelProvider, string> = {
  opencode: 'OPENCODE_API_KEY',
  gemini: 'GEMINI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
  scripted: 'scripted',
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
    return `${live} — MODEL_PROVIDER=${config.requestedModelProvider} was requested but ${PROVIDER_KEY[config.requestedModelProvider]} is not set`
  }
  if (config.modelProvider === 'scripted') {
    return `${live} — set OPENCODE_API_KEY, GEMINI_API_KEY or ANTHROPIC_API_KEY to enable a hosted model`
  }
  return live
}

function describeProvider(provider: ResolvedModelProvider, config: AppConfig): string {
  switch (provider) {
    case 'opencode':
      return `OpenCode Zen (${config.opencode.model} via ${config.opencode.baseUrl})`
    case 'gemini':
      return `Gemini (${config.gemini.model} via ${config.gemini.baseUrl})`
    case 'anthropic':
      return `Anthropic (${config.anthropic.model})`
    case 'scripted':
      return 'scripted local model'
  }
}