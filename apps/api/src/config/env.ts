import * as z from 'zod/v4'

/**
 * Environment contract. The process refuses to boot on invalid configuration, so
 * a missing or malformed variable is a startup failure rather than a runtime
 * surprise three layers deep in an adapter.
 */
const booleanish = z
  .union([z.boolean(), z.enum(['true', 'false'])])
  .transform((value) => (typeof value === 'boolean' ? value : value === 'true'))

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  API_PREFIX: z.string().default('api'),

  CORS_ORIGINS: z.string().default('http://localhost:5173'),

  DATABASE_HOST: z.string().min(1),
  DATABASE_PORT: z.coerce.number().int().min(1).max(65535).default(5432),
  DATABASE_NAME: z.string().min(1),
  DATABASE_USER: z.string().min(1),
  DATABASE_PASSWORD: z.string(),
  DATABASE_SSL: booleanish.default(false),

  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_TTL: z.coerce.number().int().positive().default(900),
  JWT_REFRESH_TTL: z.coerce.number().int().positive().default(604_800),

  ANTHROPIC_API_KEY: z.string().default(''),
  // claude-sonnet-4-5 is deprecated as of 2026-09-30; the current default is the
  // recommended replacement. Set ANTHROPIC_MODEL to opt into a different one.
  ANTHROPIC_MODEL: z.string().default('claude-sonnet-5-5'),
  ANTHROPIC_MAX_TOKENS: z.coerce.number().int().positive().default(1024),
  ANTHROPIC_TIMEOUT_MS: z.coerce.number().int().positive().default(60_000),

  // `auto` prefers Anthropic, then OpenCode Zen, then the offline generator.
  MODEL_PROVIDER: z.enum(['auto', 'anthropic', 'opencode', 'scripted']).default('auto'),
  OPENCODE_API_KEY: z.string().default(''),
  OPENCODE_BASE_URL: z.string().default('https://opencode.ai/zen/v1'),
  OPENCODE_MODEL: z.string().default('glm-5.2'),
  OPENCODE_MAX_TOKENS: z.coerce.number().int().positive().default(1024),
  OPENCODE_TIMEOUT_MS: z.coerce.number().int().positive().default(60_000),

  /**
   * Retry budget for transient provider faults, shared by every adapter.
   *
   * `maxAttempts` counts the first try, so `3` means two retries. Capped at five:
   * a caller waiting out exponential backoff stops being a retry and starts being
   * a hung request.
   */
  LLM_RETRY_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(5).default(3),
  LLM_RETRY_BASE_DELAY_MS: z.coerce.number().int().positive().default(250),
  LLM_RETRY_MAX_DELAY_MS: z.coerce.number().int().positive().default(4_000),
})

export type Env = z.infer<typeof envSchema>

/** Injection token for the validated configuration. */
export const ENV = Symbol('ENV')

/** A provider that is actually bound to the ports, i.e. `auto` already resolved. */
export type ResolvedModelProvider = Exclude<Env['MODEL_PROVIDER'], 'auto'>

/** Narrowed, camel-cased view consumed by adapters and use cases. */
export interface AppConfig {
  readonly env: Env['NODE_ENV']
  readonly port: number
  readonly apiPrefix: string
  readonly corsOrigins: readonly string[]
  readonly database: {
    readonly host: string
    readonly port: number
    readonly name: string
    readonly user: string
    readonly password: string
    readonly ssl: boolean
  }
  readonly jwt: {
    readonly accessSecret: string
    readonly refreshSecret: string
    readonly accessTtl: number
    readonly refreshTtl: number
  }
  readonly anthropic: {
    readonly apiKey: string
    readonly model: string
    readonly maxTokens: number
    /** Ceiling on one provider call. `fetch` has no default timeout of its own. */
    readonly timeoutMs: number
    /** False when no key is configured, which rules the provider out. */
    readonly enabled: boolean
  }
  readonly opencode: {
    readonly apiKey: string
    /** Root of the gateway; the adapter appends `/chat/completions`. */
    readonly baseUrl: string
    readonly model: string
    readonly maxTokens: number
    readonly timeoutMs: number
    readonly enabled: boolean
  }
  /**
   * Retry budget for transient provider faults.
   *
   * Retries only ever repeat the call to the *same* provider. Selection stays
   * config-time: a provider that stays down produces a 503 rather than being
   * quietly swapped for another model.
   */
  readonly retry: {
    /** Including the first attempt, so `3` is one call plus two retries. */
    readonly maxAttempts: number
    readonly baseDelayMs: number
    readonly maxDelayMs: number
  }
  /** What `MODEL_PROVIDER` asked for, before `auto` was resolved. */
  readonly requestedModelProvider: Env['MODEL_PROVIDER']
  /** What is actually bound to the model ports. Never `auto`. */
  readonly modelProvider: ResolvedModelProvider
}

/**
 * Decides which adapter the ports receive.
 *
 * `auto` walks the providers in cost order — Anthropic, then OpenCode Zen, then
 * the offline generator — so adding a key is the only step needed to change models.
 * An explicit request for a provider whose key is missing resolves to `scripted`
 * rather than binding an adapter that would throw on every call; the mismatch is
 * reported at boot by `describeLlmMode`.
 */
export function resolveModelProvider(env: Env): ResolvedModelProvider {
  if (env.MODEL_PROVIDER !== 'auto') {
    const requested: ResolvedModelProvider = env.MODEL_PROVIDER
    if (requested === 'anthropic' && env.ANTHROPIC_API_KEY.length === 0) return 'scripted'
    if (requested === 'opencode' && env.OPENCODE_API_KEY.length === 0) return 'scripted'
    return requested
  }
  if (env.ANTHROPIC_API_KEY.length > 0) return 'anthropic'
  if (env.OPENCODE_API_KEY.length > 0) return 'opencode'
  return 'scripted'
}

export function toAppConfig(env: Env): AppConfig {
  return {
    env: env.NODE_ENV,
    port: env.PORT,
    apiPrefix: env.API_PREFIX,
    corsOrigins: env.CORS_ORIGINS.split(',')
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0),
    database: {
      host: env.DATABASE_HOST,
      port: env.DATABASE_PORT,
      name: env.DATABASE_NAME,
      user: env.DATABASE_USER,
      password: env.DATABASE_PASSWORD,
      ssl: env.DATABASE_SSL,
    },
    jwt: {
      accessSecret: env.JWT_ACCESS_SECRET,
      refreshSecret: env.JWT_REFRESH_SECRET,
      accessTtl: env.JWT_ACCESS_TTL,
      refreshTtl: env.JWT_REFRESH_TTL,
    },
    anthropic: {
      apiKey: env.ANTHROPIC_API_KEY,
      model: env.ANTHROPIC_MODEL,
      maxTokens: env.ANTHROPIC_MAX_TOKENS,
      timeoutMs: env.ANTHROPIC_TIMEOUT_MS,
      enabled: env.ANTHROPIC_API_KEY.length > 0,
    },
    opencode: {
      apiKey: env.OPENCODE_API_KEY,
      // A trailing slash would double up when the adapter appends the path.
      baseUrl: env.OPENCODE_BASE_URL.replace(/\/+$/, ''),
      model: env.OPENCODE_MODEL,
      maxTokens: env.OPENCODE_MAX_TOKENS,
      timeoutMs: env.OPENCODE_TIMEOUT_MS,
      enabled: env.OPENCODE_API_KEY.length > 0,
    },
    retry: {
      maxAttempts: env.LLM_RETRY_MAX_ATTEMPTS,
      baseDelayMs: env.LLM_RETRY_BASE_DELAY_MS,
      maxDelayMs: env.LLM_RETRY_MAX_DELAY_MS,
    },
    requestedModelProvider: env.MODEL_PROVIDER,
    modelProvider: resolveModelProvider(env),
  }
}