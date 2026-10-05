import type {
  ChatMessage as ContractChatMessage,
  ChatStreamEvent as ContractChatStreamEvent,
  ChatThread as ContractChatThread,
} from '@dme/contracts'

/**
 * The contract types are the UI types.
 *
 * Re-declaring them here would be a second source of truth that can drift; the
 * drawer only needs a view model for the message it is currently rendering.
 */

export type ChatThread = ContractChatThread
export type ChatMessage = ContractChatMessage
export type ChatStreamEvent = ContractChatStreamEvent

/** A message as the drawer shows it, including the partial one being streamed. */
export interface DisplayMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
  /** True while the text is still arriving; the bubble renders it as it grows. */
  streaming?: boolean
  /** Set on an assistant turn so a reply can be attributed. */
  model?: string
}