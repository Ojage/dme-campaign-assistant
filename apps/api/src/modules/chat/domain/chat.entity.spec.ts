import { ChatMessage, ChatThread, isChatRole } from './chat.entity'
import { ValidationError } from '../../../shared/domain/domain.errors'

/**
 * Thread titles are derived from the first thing the user said, so the rules
 * that shape them are pinned down here.
 */

describe('chat roles', () => {
  it('accepts only the two roles the transcript stores', () => {
    expect(isChatRole('user')).toBe(true)
    expect(isChatRole('assistant')).toBe(true)
    expect(isChatRole('system')).toBe(false)
  })
})

describe('thread titles', () => {
  it('falls back to a placeholder when nothing was typed', () => {
    expect(ChatThread.create().title).toBe('New conversation')
  })

  it('uses the text the user gave', () => {
    expect(ChatThread.create('Campaign for the Q3 launch').title).toBe('Campaign for the Q3 launch')
  })

  it('uses only the first line of a multi-line message', () => {
    expect(ChatThread.titleFrom('Launch the spring promo\nand target loyal users')).toBe('Launch the spring promo')
  })

  it('shortens a long first line and marks the cut', () => {
    const title = ChatThread.titleFrom('x'.repeat(200))
    expect(title.length).toBeLessThanOrEqual(60)
    expect(title.endsWith('…')).toBe(true)
  })
})

describe('a new thread', () => {
  it('starts empty and untouched', () => {
    const thread = ChatThread.create()
    expect(thread.messageCount).toBe(0)
    expect(thread.createdAt).toEqual(thread.updatedAt)
  })

  it('renders as a transcript-safe JSON view', () => {
    const thread = ChatThread.create('Reminder')
    expect(JSON.parse(JSON.stringify(thread))).toMatchObject({ title: 'Reminder', messageCount: 0 })
  })
})

describe('a message', () => {
  it('keeps the role and trims the content', () => {
    const message = ChatMessage.create('thread-1', { role: 'user', content: '  Hello  ' })
    expect(message.role).toBe('user')
    expect(message.content).toBe('Hello')
    expect(message.threadId).toBe('thread-1')
    expect(message.model).toBeUndefined()
  })

  it('refuses an empty message', () => {
    expect(() => ChatMessage.create('thread-1', { role: 'user', content: '   ' })).toThrow(ValidationError)
  })

  it('refuses to attribute a user turn to a model', () => {
    expect(() => ChatMessage.create('thread-1', { role: 'user', content: 'Hi', model: 'claude' })).toThrow(
      ValidationError,
    )
  })

  it('attributes an assistant turn to the model that wrote it', () => {
    const reply = ChatMessage.fromModel('thread-1', 'Here is a campaign.', 'scripted-fallback')
    expect(reply.role).toBe('assistant')
    expect(reply.model).toBe('scripted-fallback')
  })
})