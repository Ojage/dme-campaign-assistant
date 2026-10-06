import { envSchema, resolveModelProvider, toAppConfig } from './env'

/**
 * The provider is chosen once, at boot, from configuration alone. These tests pin
 * the precedence order and the fallback, because getting either wrong is silent:
 * the app keeps working, just against a different model than the operator expects.
 */

/** Everything the schema requires; individual tests override only what they assert. */
const BASE = {
  DATABASE_HOST: 'localhost',
  DATABASE_NAME: 'dme',
  DATABASE_USER: 'dme',
  DATABASE_PASSWORD: 'dme',
  JWT_ACCESS_SECRET: 'a'.repeat(16),
  JWT_REFRESH_SECRET: 'b'.repeat(16),
} as const

function resolve(overrides: Record<string, string> = {}) {
  return resolveModelProvider(envSchema.parse({ ...BASE, ...overrides }))
}

describe('resolveModelProvider', () => {
  it('generates locally when no provider has a key', () => {
    expect(resolve()).toBe('scripted')
  })

  it('prefers OpenCode over Gemini and Anthropic when all three are configured', () => {
    expect(
      resolve({ OPENCODE_API_KEY: 'sk-zen', GEMINI_API_KEY: 'sk-gem', ANTHROPIC_API_KEY: 'sk-ant' }),
    ).toBe('opencode')
  })

  it('prefers Gemini over Anthropic when both are configured', () => {
    expect(resolve({ GEMINI_API_KEY: 'sk-gem', ANTHROPIC_API_KEY: 'sk-ant' })).toBe('gemini')
  })

  it('prefers Anthropic when it is the only hosted provider with a key', () => {
    expect(resolve({ ANTHROPIC_API_KEY: 'sk-ant' })).toBe('anthropic')
  })

  it('uses OpenCode when it is the only provider with a key', () => {
    expect(resolve({ OPENCODE_API_KEY: 'sk-zen' })).toBe('opencode')
  })

  it('uses Gemini when it is the only provider with a key', () => {
    expect(resolve({ GEMINI_API_KEY: 'sk-gem' })).toBe('gemini')
  })

  it('treats an empty key as no key', () => {
    expect(resolve({ ANTHROPIC_API_KEY: '', GEMINI_API_KEY: '', OPENCODE_API_KEY: '' })).toBe('scripted')
  })

  it('honours an explicit choice over the auto order', () => {
    const all = { ANTHROPIC_API_KEY: 'sk-ant', GEMINI_API_KEY: 'sk-gem', OPENCODE_API_KEY: 'sk-zen' }
    expect(resolve({ ...all, MODEL_PROVIDER: 'opencode' })).toBe('opencode')
    expect(resolve({ ...all, MODEL_PROVIDER: 'gemini' })).toBe('gemini')
    expect(resolve({ ...all, MODEL_PROVIDER: 'anthropic' })).toBe('anthropic')
  })

  it('falls back to the generator when the requested provider has no key', () => {
    expect(resolve({ MODEL_PROVIDER: 'opencode', OPENCODE_API_KEY: '' })).toBe('scripted')
    expect(resolve({ MODEL_PROVIDER: 'gemini', GEMINI_API_KEY: '' })).toBe('scripted')
    expect(resolve({ MODEL_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: '' })).toBe('scripted')
  })

  it('generates locally when asked to, even with keys present', () => {
    expect(resolve({ MODEL_PROVIDER: 'scripted', ANTHROPIC_API_KEY: 'sk-ant' })).toBe('scripted')
  })
})

describe('toAppConfig', () => {
  it('exposes the requested choice alongside the resolved one', () => {
    const config = toAppConfig(envSchema.parse({ ...BASE, MODEL_PROVIDER: 'opencode', OPENCODE_API_KEY: '' }))
    expect(config.requestedModelProvider).toBe('opencode')
    expect(config.modelProvider).toBe('scripted')
  })

  it('normalises the gateway root so the path is not doubled up', () => {
    const config = toAppConfig(envSchema.parse({ ...BASE, OPENCODE_BASE_URL: 'https://gw.example.com/v1//' }))
    expect(config.opencode.baseUrl).toBe('https://gw.example.com/v1')
    const gemini = toAppConfig(envSchema.parse({ ...BASE, GEMINI_BASE_URL: 'https://gem.example.com/v1beta//' }))
    expect(gemini.gemini.baseUrl).toBe('https://gem.example.com/v1beta')
  })

  it('rules a provider out only when its key is empty', () => {
    const config = toAppConfig(envSchema.parse({ ...BASE, OPENCODE_API_KEY: 'sk-zen' }))
    expect(config.opencode.enabled).toBe(true)
    expect(config.gemini.enabled).toBe(false)
    expect(config.anthropic.enabled).toBe(false)
    const gemini = toAppConfig(envSchema.parse({ ...BASE, GEMINI_API_KEY: 'sk-gem' }))
    expect(gemini.gemini.enabled).toBe(true)
  })

  it('rejects a malformed configuration at parse time', () => {
    expect(() => envSchema.parse({ ...BASE, JWT_ACCESS_SECRET: 'short' })).toThrow()
    expect(() => envSchema.parse({ ...BASE, MODEL_PROVIDER: 'openai' })).toThrow()
    expect(() => envSchema.parse({ ...BASE, OPENCODE_MAX_TOKENS: '0' })).toThrow()
  })
})