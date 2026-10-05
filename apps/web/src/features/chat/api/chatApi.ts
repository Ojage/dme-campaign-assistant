/**
 * Chat API — live calls through the shared client.
 *
 * The reply arrives as server-sent events so it can be rendered as it is written.
 * `chat.messages.send` exists for clients that cannot stream; the drawer uses the
 * stream, because a two-second wait with nothing on screen is the difference
 * between a conversation and a form submission.
 */

import { apiClient } from '@/lib/api/apiClient'
import type { ChatMessage, ChatStreamEvent, ChatThread } from '@/features/chat/types/chat.types'

export function getThreads(): Promise<ChatThread[]> {
  return apiClient.call('chat.threads.list')
}

export function createThread(title?: string): Promise<ChatThread> {
  return apiClient.call('chat.threads.create', { body: { title } })
}

export function getMessages(threadId: string): Promise<ChatMessage[]> {
  return apiClient.call('chat.messages.list', { params: { threadId } })
}

export function deleteThread(id: string): Promise<null> {
  return apiClient.call('chat.threads.delete', { params: { id } })
}

/**
 * Yields the reply as it is produced, until the server closes the stream.
 *
 * `signal` closes the connection, so a drawer that unmounts mid-reply releases
 * the request instead of holding it open.
 */
export async function* streamReply(
  threadId: string,
  content: string,
  language: 'en' | 'fr',
  signal?: AbortSignal,
): AsyncGenerator<ChatStreamEvent, void, undefined> {
  yield* apiClient.stream('chat.messages.stream', {
    params: { threadId },
    body: { content, language },
    ...(signal === undefined ? {} : { signal }),
  })
}