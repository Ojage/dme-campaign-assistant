import { envSchema, toAppConfig } from '../../../config/env'
import type { AppConfig } from '../../../config/env'
import { describeLlmMode, selectAdapters } from './llm-selection'
import type { AdapterSet } from './llm-selection'
import { RetryingModel } from './retrying-model'

/**
 * Selection is the one piece of the wiring a misconfiguration is invisible in: the
 * app still answers, just from a different model. These tests pin both the choice
 * and the boot line that explains it.
 */

const BASE = {
  DATABASE_HOST: 'localhost',
  DATABASE_NAME: 'dme',
  DATABASE_USER: 'dme',
  DATABASE_PASSWORD: 'dme',
  JWT_ACCESS_SECRET: 'a'.repeat(16),
  JWT_REFRESH_SECRET: 'b'.repeat(16),
} as const

function configFor(overrides: Record<string, string> = {}): AppConfig {
  return toAppConfig(envSchema.parse({ ...BASE, ...overrides }))
}

/**
 * Stand-ins identifiable by their `modelId`, which is what the returned model
 * reports and therefore the only thing selection can be observed through. The cast
 * is safe because selection reads nothing else.
 */
function adapters(): AdapterSet {
  const make = (modelId: string) => ({ modelId }) as unknown as AdapterSet['opencode']
  return { anthropic: make('claude-sonnet-4-5'), opencode: make('glm-5.2'), scripted: make('scripted-local') }
}

describe('selectAdapters', () => {
  it('binds the adapter the configuration resolved to', () => {
    const set = adapters()
    expect(selectAdapters(configFor({ MODEL_PROVIDER: 'opencode', OPENCODE_API_KEY: 'sk-zen' }), set).modelId).toBe(
      'glm-5.2',
    )
    expect(
      selectAdapters(configFor({ MODEL_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: 'sk-ant' }), set).modelId,
    ).toBe('claude-sonnet-4-5')
    expect(selectAdapters(configFor({ MODEL_PROVIDER: 'scripted' }), set).modelId).toBe('scripted-local')
  })

  it('wraps the chosen adapter in the retry policy', () => {
    const set = adapters()
    expect(selectAdapters(configFor({ OPENCODE_API_KEY: 'sk-zen' }), set)).toBeInstanceOf(RetryingModel)
  })

  it('reports the inner model id, so the client still learns which model answered', () => {
    const set = adapters()
    expect(selectAdapters(configFor({ OPENCODE_API_KEY: 'sk-zen' }), set).modelId).toBe(set.opencode.modelId)
  })
})

describe('describeLlmMode', () => {
  it('names the provider and model that will answer', () => {
    expect(describeLlmMode(configFor({ ANTHROPIC_API_KEY: 'sk-ant' }))).toBe('Anthropic (claude-sonnet-4-5)')
    expect(describeLlmMode(configFor({ OPENCODE_API_KEY: 'sk-zen' }))).toBe(
      'OpenCode Zen (glm-5.2 via https://opencode.ai/zen/v1)',
    )
  })

  it('points at the missing key when the requested provider has none', () => {
    expect(describeLlmMode(configFor({ MODEL_PROVIDER: 'opencode', OPENCODE_API_KEY: '' }))).toBe(
      'scripted local model — MODEL_PROVIDER=opencode was requested but OPENCODE_API_KEY is not set',
    )
  })

  it('suggests a key when nothing is configured at all', () => {
    expect(describeLlmMode(configFor())).toBe(
      'scripted local model — set ANTHROPIC_API_KEY or OPENCODE_API_KEY to enable a hosted model',
    )
  })

  it('does not mention a mismatch when auto legitimately picked scripted', () => {
    // `auto` with no keys is the documented offline path, not a misconfiguration.
    expect(describeLlmMode(configFor())).not.toContain('was requested')
  })

  it('does not mention a key when the requested provider was honoured', () => {
    expect(describeLlmMode(configFor({ MODEL_PROVIDER: 'opencode', OPENCODE_API_KEY: 'sk-zen' }))).not.toContain(
      'is not set',
    )
  })
})