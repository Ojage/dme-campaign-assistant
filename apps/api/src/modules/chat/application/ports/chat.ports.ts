import type { ChatMessage, ChatThread } from '../../domain/chat.entity'

export interface ChatThreadRepository {
  list(): Promise<ChatThread[]>
  findById(id: string): Promise<ChatThread | null>
  create(thread: ChatThread): Promise<ChatThread>
  rename(id: string, title: string): Promise<ChatThread | null>
  delete(id: string): Promise<boolean>
}

export interface ChatMessageRepository {
  list(threadId: string): Promise<ChatMessage[]>
  append(message: ChatMessage): Promise<ChatMessage>
}

/** Counts messages per thread in one query for the sidebar. */
export interface ChatMessageCounter {
  countsByThread(threadIds: readonly string[]): Promise<ReadonlyMap<string, number>>
}

export const CHAT_PORTS = {
  threadRepository: Symbol('CHAT.threadRepository'),
  messageRepository: Symbol('CHAT.messageRepository'),
  messageCounter: Symbol('CHAT.messageCounter'),
} as const