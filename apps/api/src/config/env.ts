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
  ANTHROPIC_MODEL: z.string().default('claude-sonnet-4-5'),
  ANTHROPIC_MAX_TOKENS: z.coerce.number().int().positive().default(1024),
})

export type Env = z.infer<typeof envSchema>

/** Injection token for the validated configuration. */
export const ENV = Symbol('ENV')

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
    /** False when no key is configured, which selects the local generator. */
    readonly enabled: boolean
  }
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
      enabled: env.ANTHROPIC_API_KEY.length > 0,
    },
  }
}