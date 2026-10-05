/**
 * Driven port for free-form text generation, used by the chat domain.
 *
 * Splitting this from `StructuredModel` keeps each consumer dependent only on the
 * capability it uses (interface segregation), even though one adapter satisfies
 * both.
 */
export interface ModelTurn {
  readonly role: 'user' | 'assistant'
  readonly content: string
}

export interface TextGenerationRequest {
  /** System prompt. Behavioural instructions belong here, not in the turns. */
  readonly system: string
  readonly turns: readonly ModelTurn[]
  readonly maxTokens?: number
  readonly temperature?: number
  readonly signal?: AbortSignal
}

export interface TextGenerationResult {
  readonly text: string
  readonly model: string
}

export interface TextModel {
  /** Model identifier reported to the client, e.g. `claude-sonnet-4-5`. */
  readonly modelId: string
  generate(request: TextGenerationRequest): Promise<TextGenerationResult>
  /** Yields text deltas as they arrive. */
  stream(request: TextGenerationRequest): AsyncGenerator<string, void, undefined>
}

export const TEXT_MODEL = Symbol('TEXT_MODEL')