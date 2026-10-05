import type * as z from 'zod/v4'
import type { ModelTurn } from './text-model.port'

/**
 * Driven port for generation that must satisfy a schema, used by the campaigns
 * domain. The schema is part of the request, so a caller cannot ask for a shape
 * the adapter does not know how to produce.
 */
export interface StructuredGenerationRequest<TSchema extends z.ZodTypeAny> {
  readonly system: string
  readonly turns: readonly ModelTurn[]
  readonly schema: TSchema
  readonly maxTokens?: number
  readonly signal?: AbortSignal
}

export interface StructuredGenerationResult<TOutput> {
  readonly data: TOutput
  readonly model: string
}

export interface StructuredModel {
  readonly modelId: string
  generateStructured<TSchema extends z.ZodTypeAny>(
    request: StructuredGenerationRequest<TSchema>,
  ): Promise<StructuredGenerationResult<z.output<TSchema>>>
}

export const STRUCTURED_MODEL = Symbol('STRUCTURED_MODEL')