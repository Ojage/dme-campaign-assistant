import { ValidationError } from '../../../shared/domain/domain.errors'

export const CHAT_ROLES = ['user', 'assistant'] as const
export type ChatRole = (typeof CHAT_ROLES)[number]

export type ChatLanguage = 'en' | 'fr'

export const isChatRole = (value: string): value is ChatRole => (CHAT_ROLES as readonly string[]).includes(value)

/** Longest title derived from a first message before the user names the thread. */
const TITLE_LIMIT = 60

export interface NewChatMessage {
  readonly role: ChatRole
  readonly content: string
  readonly model?: string
}

export class ChatMessage {
  private constructor(
    public readonly id: string,
    public readonly threadId: string,
    public readonly role: ChatRole,
    public readonly content: string,
    public readonly model: string | undefined,
    public readonly createdAt: Date,
  ) {}

  public static reconstitute(input: {
    id: string
    threadId: string
    role: ChatRole
    content: string
    model?: string
    createdAt: Date
  }): ChatMessage {
    return new ChatMessage(
      input.id,
      input.threadId,
      input.role,
      input.content,
      input.model,
      input.createdAt,
    )
  }

  public static create(threadId: string, message: NewChatMessage): ChatMessage {
    const content = message.content.trim()
    if (content.length === 0) {
      throw new ValidationError('Write something before sending.', { content: ['Write something before sending.'] })
    }
    if (message.role === 'user' && message.model !== undefined) {
      throw new ValidationError('A user turn cannot be attributed to a model.')
    }
    return new ChatMessage('', threadId, message.role, content, message.model, new Date())
  }

  /** An assistant turn must know which model wrote it, so replies stay attributable. */
  public static fromModel(threadId: string, content: string, model: string): ChatMessage {
    return ChatMessage.create(threadId, { role: 'assistant', content, model })
  }
}

export class ChatThread {
  private constructor(
    public readonly id: string,
    public readonly title: string,
    public readonly messageCount: number,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}

  public static reconstitute(input: {
    id: string
    title: string
    messageCount: number
    createdAt: Date
    updatedAt: Date
  }): ChatThread {
    return new ChatThread(input.id, input.title, input.messageCount, input.createdAt, input.updatedAt)
  }

  public static create(title?: string): ChatThread {
    const now = new Date()
    return new ChatThread('', title?.trim() ?? 'New conversation', 0, now, now)
  }

  /** Used when a conversation starts from an untitled thread. */
  public static titleFrom(content: string): string {
    const firstLine = content.trim().split('\n')[0] ?? ''
    return firstLine.length <= TITLE_LIMIT ? firstLine : `${firstLine.slice(0, TITLE_LIMIT - 1)}…`
  }
}