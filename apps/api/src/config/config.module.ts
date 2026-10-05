import { Global, Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { ENV, envSchema, toAppConfig, type AppConfig } from './env'

/**
 * Composition root for configuration. The environment is validated once, here,
 * and the resulting `AppConfig` is the only configuration shape the rest of the
 * codebase sees — no other module touches `process.env`.
 */
@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      // Local `.env` is a convenience; the container environment wins.
      envFilePath: ['.env.local', '.env'],
      // Validation happens in the ENV factory below, so the raw values are parsed
      // exactly once and both the schema check and the mapping stay in one place.
    }),
  ],
  providers: [
    {
      provide: ENV,
      useFactory: (): AppConfig => toAppConfig(envSchema.parse(process.env)),
    },
  ],
  exports: [ENV],
})
export class ConfigModuleRoot {}