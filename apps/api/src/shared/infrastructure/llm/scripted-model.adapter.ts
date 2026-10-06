import { Injectable } from '@nestjs/common'
import * as z from 'zod/v4'
import { ModelProviderError } from '../../domain/domain.errors'
import type {
  ModelTurn,
  TextGenerationRequest,
  TextGenerationResult,
  TextModel,
} from '../../application/ports/text-model.port'
import type {
  StructuredGenerationRequest,
  StructuredGenerationResult,
  StructuredModel,
} from '../../application/ports/structured-model.port'

const CHAT_REPLY = [
  'I can help with that. In this workspace I can draft campaign copy, build audiences from customer behaviour, and explain how a segment was matched.',
  'Tell me the objective, the channel (SMS, email or push) and the tone you want, and I will draft something you can review.',
].join(' ')

/** Splits text the way a token stream would arrive, so consumers behave identically. */
function chunk(text: string): string[] {
  return text.match(/.{1,24}/g) ?? [text]
}

/**
 * Offline stand-in for a hosted model.
 *
 * Selected by `LlmModule` when no Anthropic key is configured. It implements both
 * ports, so the whole application — including streaming — works end to end without
 * a paid dependency; swapping in the real adapter changes nothing above the port.
 */
@Injectable()
export class ScriptedModelAdapter implements TextModel, StructuredModel {
  public readonly modelId = 'scripted-local'

  public async generate(request: TextGenerationRequest): Promise<TextGenerationResult> {
    const last = latestUserTurn(request.turns)
    return { text: `${CHAT_REPLY}\n\nYou asked: ${truncate(last, 120)}`, model: this.modelId }
  }

  public async *stream(request: TextGenerationRequest): AsyncGenerator<string, void, undefined> {
    const last = latestUserTurn(request.turns)
    for (const part of chunk(`${CHAT_REPLY}\n\nYou asked: ${truncate(last, 120)}`)) {
      yield part
      // A small delay keeps the client-side streaming path honest in development.
      await delay(15)
    }
  }

  /**
   * Fills the requested schema from the prompt.
   *
   * The schema is walked through its public API and the result is parsed back
   * through it, so the port's guarantee — "the output satisfies this schema" — is
   * enforced here rather than assumed.
   */
  public async generateStructured<TSchema extends z.ZodTypeAny>(
    request: StructuredGenerationRequest<TSchema>,
  ): Promise<StructuredGenerationResult<z.output<TSchema>>> {
    const turn = latestUserTurn(request.turns)
    const topic = objectiveOf(turn)
    const channel = channelOf(turn)
    const draft = this.#build(request.schema, topic, channel)

    const parsed = request.schema.safeParse(draft)
    if (!parsed.success) {
      throw new ModelProviderError(
        'The local generator could not satisfy the requested schema.',
        'llm_error',
      )
    }
    return { data: parsed.data as z.output<TSchema>, model: this.modelId }
  }

  /** Produces a value of the right type for every field the caller demanded. */
  #build(schema: z.ZodTypeAny, topic: string, channel: string): unknown {
    if (schema instanceof z.ZodObject) {
      // ZodObject.shape is `Record<string, unknown>` to callers, so the field type
      // is recovered here rather than trusted.
      const shape = schema.shape as Record<string, unknown>
      return Object.fromEntries(
        Object.entries(shape).map(([key, field]) => {
          const fieldSchema = field instanceof z.ZodType ? (field as z.ZodTypeAny) : z.string()
          return [key, this.#value(fieldSchema, key, topic, channel)]
        }),
      )
    }
    return this.#value(schema, 'value', topic, channel)
  }

  #value(schema: z.ZodTypeAny, fieldName: string, topic: string, channel: string): unknown {
    // Optional/default/nullable wrappers all wrap the schema that actually matters.
    if (schema instanceof z.ZodOptional || schema instanceof z.ZodNullable || schema instanceof z.ZodDefault) {
      // `unwrap` is declared as the internal base type, so it is re-widened here.
      return this.#value(schema.unwrap() as z.ZodTypeAny, fieldName, topic, channel)
    }
    if (schema instanceof z.ZodString) return copyFor(fieldName, topic, channel)
    if (schema instanceof z.ZodNumber) return 0
    if (schema instanceof z.ZodBoolean) return false
    if (schema instanceof z.ZodEnum) return schema.options[0]
    if (schema instanceof z.ZodArray) return []
    return topic
  }
}

/**
 * Channel where the recipient reads the body alone, so the copy has to end with
 * the call to action rather than leaving it in a field nothing will display.
 */
function textOnly(channel: string): boolean {
  return channel === 'sms' || channel === 'push'
}

const CALL_TO_ACTION = 'Discover more today'

/** Field-specific copy so a generated draft reads like a draft, not a placeholder. */
function copyFor(fieldName: string, topic: string, channel: string): string {
  switch (fieldName) {
    case 'title':
      return truncate(topic.split('\n')[0] ?? topic, 60)
    case 'callToAction':
      return CALL_TO_ACTION
    case 'message':
      return textOnly(channel)
        ? `${truncate(topic, 120)} ${CALL_TO_ACTION}`
        : `We would like to keep serving you. ${truncate(topic, 140)}`
    default:
      return `Scripted ${fieldName} for: ${truncate(topic, 80)}`
  }
}

function latestUserTurn(turns: readonly ModelTurn[]): string {
  const last = [...turns].reverse().find((turn) => turn.role === 'user')
  return last?.content ?? ''
}

/**
 * Prompts carry context on their own lines; the local generator copies the part a
 * marketer would recognise as the subject rather than the whole instruction block.
 */
function objectiveOf(turn: string): string {
  return fieldOf(turn, 'Objective') ?? turn
}

/** The channel the copy is for, so text-only channels can carry the call to action. */
function channelOf(turn: string): string {
  return (fieldOf(turn, 'Channel') ?? '').trim().toLowerCase()
}

/** Reads one `Label: value` line out of the prompt. */
function fieldOf(turn: string, label: string): string | undefined {
  const line = turn.split('\n').find((candidate) => candidate.startsWith(`${label}:`))
  const text = line?.slice(label.length + 1).trim()
  return text !== undefined && text.length > 0 ? text : undefined
}

function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}