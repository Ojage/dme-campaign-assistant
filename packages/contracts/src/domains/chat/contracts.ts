import * as z from 'zod/v4'
import { idSchema, isoDateTimeSchema } from '../shared.js'

export const chatRoleSchema = z.enum(['user', 'assistant'])
export type ChatRole = z.infer<typeof chatRoleSchema>

export const chatThreadSchema = z.object({
  id: idSchema,
  title: z.string().min(1),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
  /** Cached so the sidebar can render counts without loading every thread. */
  messageCount: z.number().int().min(0),
})
export type ChatThread = z.infer<typeof chatThreadSchema>

export const chatMessageSchema = z.object({
  id: idSchema,
  threadId: idSchema,
  role: chatRoleSchema,
  content: z.string(),
  /** Model that produced an assistant turn; absent on user turns. */
  model: z.string().min(1).optional(),
  createdAt: isoDateTimeSchema,
})
export type ChatMessage = z.infer<typeof chatMessageSchema>

export const createThreadRequestSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
})
export type CreateThreadRequest = z.infer<typeof createThreadRequestSchema>

export const sendMessageRequestSchema = z.object({
  content: z.string().trim().min(1).max(8000),
  language: z.enum(['en', 'fr']).default('en'),
})
export type SendMessageRequest = z.infer<typeof sendMessageRequestSchema>

/**
 * Server-sent event payloads for a streamed assistant reply. A discriminated
 * union keeps the client switch exhaustive.
 */
export const chatStreamEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('start'), threadId: idSchema, userMessageId: idSchema }),
  z.object({ type: z.literal('delta'), text: z.string() }),
  z.object({ type: z.literal('done'), assistantMessage: chatMessageSchema }),
  z.object({ type: z.literal('error'), code: z.string().min(1), message: z.string().min(1) }),
])
export type ChatStreamEvent = z.infer<typeof chatStreamEventSchema>

export const sendMessageResponseSchema = z.object({
  userMessage: chatMessageSchema,
  assistantMessage: chatMessageSchema,
})
export type SendMessageResponse = z.infer<typeof sendMessageResponseSchema>