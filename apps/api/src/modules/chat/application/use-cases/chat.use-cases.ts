import { Inject, Injectable } from '@nestjs/common'
import { NotFoundError } from '../../../../shared/domain/domain.errors'
import { TEXT_MODEL } from '../../../../shared/application/ports/text-model.port'
import type { ModelTurn, TextModel } from '../../../../shared/application/ports/text-model.port'
import { CHAT_PORTS } from '../ports/chat.ports'
import type {
  ChatMessageCounter,
  ChatMessageRepository,
  ChatThreadRepository,
} from '../ports/chat.ports'
import { ChatMessage, ChatThread, type ChatLanguage } from '../../domain/chat.entity'

export interface SendMessageInput {
  readonly content: string
  readonly language: ChatLanguage
}

export interface SendMessageResult {
  readonly userMessage: ChatMessage
  readonly assistantMessage: ChatMessage
}

@Injectable()
export class ListThreads {
  public constructor(
    @Inject(CHAT_PORTS.threadRepository) private readonly threads: ChatThreadRepository,
    @Inject(CHAT_PORTS.messageCounter) private readonly counter: ChatMessageCounter,
  ) {}

  public async execute(): Promise<ChatThread[]> {
    const threads = await this.threads.list()
    if (threads.length === 0) return threads

    const counts = await this.counter.countsByThread(threads.map((thread) => thread.id))
    return threads.map((thread) => ChatThread.reconstitute({
      id: thread.id,
      title: thread.title,
      messageCount: counts.get(thread.id) ?? 0,
      createdAt: thread.createdAt,
      updatedAt: thread.updatedAt,
    }))
  }
}

@Injectable()
export class CreateThread {
  public constructor(@Inject(CHAT_PORTS.threadRepository) private readonly threads: ChatThreadRepository) {}

  public execute(title?: string): Promise<ChatThread> {
    return this.threads.create(ChatThread.create(title))
  }
}

@Injectable()
export class DeleteThread {
  public constructor(@Inject(CHAT_PORTS.threadRepository) private readonly threads: ChatThreadRepository) {}

  public async execute(id: string): Promise<void> {
    // Messages cascade at the database level.
    if (!(await this.threads.delete(id))) throw new NotFoundError('That conversation no longer exists.')
  }
}

@Injectable()
export class ListMessages {
  public constructor(
    @Inject(CHAT_PORTS.messageRepository) private readonly messages: ChatMessageRepository,
    @Inject(CHAT_PORTS.threadRepository) private readonly threads: ChatThreadRepository,
  ) {}

  public async execute(threadId: string): Promise<ChatMessage[]> {
    await this.#requireThread(threadId)
    return this.messages.list(threadId)
  }

  async #requireThread(threadId: string): Promise<void> {
    const thread = await this.threads.findById(threadId)
    if (thread === null) throw new NotFoundError('That conversation no longer exists.')
  }
}

/**
 * Records the user turn, asks the model for a reply, then records the reply.
 *
 * The history sent to the model is trimmed to the last `HISTORY_TURNS` turns so a
 * long conversation cannot exceed the context window, while the stored history
 * stays complete.
 */
@Injectable()
export class SendMessage {
  public constructor(
    @Inject(CHAT_PORTS.messageRepository) private readonly messages: ChatMessageRepository,
    @Inject(CHAT_PORTS.threadRepository) private readonly threads: ChatThreadRepository,
    @Inject(TEXT_MODEL) private readonly model: TextModel,
  ) {}

  public async execute(threadId: string, input: SendMessageInput): Promise<SendMessageResult> {
    const thread = await this.threads.findById(threadId)
    if (thread === null) throw new NotFoundError('That conversation no longer exists.')

    const userMessage = await this.messages.append(ChatMessage.create(threadId, { role: 'user', content: input.content }))
    if (thread.title === 'New conversation') {
      await this.threads.rename(threadId, ChatThread.titleFrom(userMessage.content))
    }

    const history = await this.messages.list(threadId)
    const result = await this.model.generate({
      system: systemPrompt(input.language),
      turns: toTurns(history),
    })

    const assistantMessage = await this.messages.append(
      ChatMessage.fromModel(threadId, result.text, result.model),
    )

    return { userMessage, assistantMessage }
  }
}

/**
 * Streams a reply token by token.
 *
 * Used by the SSE endpoint. The user turn is persisted before streaming starts,
 * and the assistant turn only once the stream completes, so an aborted stream
 * leaves no half-written reply behind.
 */
@Injectable()
export class StreamMessage {
  public constructor(
    @Inject(CHAT_PORTS.messageRepository) private readonly messages: ChatMessageRepository,
    @Inject(CHAT_PORTS.threadRepository) private readonly threads: ChatThreadRepository,
    @Inject(TEXT_MODEL) private readonly model: TextModel,
  ) {}

  public async *execute(
    threadId: string,
    input: SendMessageInput,
    signal?: AbortSignal,
  ): AsyncGenerator<ChatStreamEvent, void, undefined> {
    const thread = await this.threads.findById(threadId)
    if (thread === null) throw new NotFoundError('That conversation no longer exists.')

    const userMessage = await this.messages.append(
      ChatMessage.create(threadId, { role: 'user', content: input.content }),
    )
    yield { type: 'start', threadId, userMessageId: userMessage.id }

    if (thread.title === 'New conversation') {
      await this.threads.rename(threadId, ChatThread.titleFrom(userMessage.content))
    }

    const history = await this.messages.list(threadId)
    const stream = this.model.stream({ system: systemPrompt(input.language), turns: toTurns(history), signal })

    let answer = ''
    for await (const delta of stream) {
      answer += delta
      yield { type: 'delta', text: delta }
    }

    const assistantMessage = await this.messages.append(
      ChatMessage.fromModel(threadId, answer, this.model.modelId),
    )
    yield { type: 'done', assistantMessage }
  }
}

/** Mirrors `chatStreamEventSchema` in the shared contract. */
export type ChatStreamEvent =
  | { readonly type: 'start'; readonly threadId: string; readonly userMessageId: string }
  | { readonly type: 'delta'; readonly text: string }
  | { readonly type: 'done'; readonly assistantMessage: ChatMessage }
  | { readonly type: 'error'; readonly code: string; readonly message: string }

function toTurns(history: readonly ChatMessage[]): ModelTurn[] {
  return history.slice(-HISTORY_TURNS).map((message) => ({ role: message.role, content: message.content }))
}

function systemPrompt(language: ChatLanguage): string {
  return [
    'You are Campaign Assistant, an internal AI tool built for the DME Systems marketing team.',
    'Your role is to help marketers understand customer activity, build targeted customer segments, and generate campaign content.',
    '',
    'You can help with:',
    '- Explaining customer KPIs and what they mean for campaign strategy',
    '- Suggesting segment conditions based on a campaign objective',
    '- Generating campaign titles, messages, and calls-to-action for SMS, Email, or Push channels',
    '- Adapting tone: professional, friendly, urgent, or promotional',
    '',
    'When generating campaign content:',
    '- Use only the customer data, segment details, and campaign objective the marketer provides',
    '- Never invent customer names, transaction figures, balances, or segment sizes',
    '- Always tailor the message to the specified channel — SMS must be short (under 160 characters), Email can be richer, Push must be punchy',
    '- Always include a clear call-to-action',
    '',
    'Answer in markdown. Keep answers under 200 words unless more detail is requested.',
    '',
    language === 'fr'
      ? 'Reply in French unless the marketer writes in another language.'
      : 'Reply in English unless the marketer writes in another language.',
  ].join('\n')
}

/** Model context is bounded by keeping only the most recent turns. */
const HISTORY_TURNS = 12
