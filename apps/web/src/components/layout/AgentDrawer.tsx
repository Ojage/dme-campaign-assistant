import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AnimatePresence, motion } from 'framer-motion'
import { Bot, Plus, Send, Trash2, X } from 'lucide-react'
import { Button } from '@/components/common/Button'
import { ScrollArea } from '@/components/common/ScrollArea'
import { useAssistantActivity } from '@/app/providers/AssistantActivityProvider'
import { useChatThread } from '@/features/chat/hooks/useChatThread'
import { useAppLanguage } from '@/hooks/useAppLanguage'
import { cn } from '@/lib/utils'

/**
 * Agent drawer. Slides in from the right edge of the child panel — its parent —
 * so it reads as part of the dashboard surface rather than a system overlay.
 *
 * The conversation is the API's, not the component's: threads and transcripts are
 * read from the server, and the reply is rendered as the stream delivers it.
 */
export function AgentDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation('common')
  const { language } = useAppLanguage()
  const {
    messages,
    threads,
    isStreaming,
    error,
    threadId,
    selectThread,
    reset,
    send,
  } = useChatThread(language, t('agent.unreachable'))
  const [draft, setDraft] = useState('')
  const bodyRef = useRef<HTMLDivElement>(null)

  // Drafting a reply lights the page-wide activity bar for the whole app.
  useAssistantActivity('agent-drawer', isStreaming)

  // Opening the drawer shows the newest conversation, or an empty one.
  useEffect(() => {
    if (!open) return
    if (threadId === null && threads.length > 0) selectThread(threads[0].id)
  }, [open, threadId, threads, selectThread])

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, isStreaming])

  const submit = () => {
    const text = draft.trim()
    if (text.length === 0 || isStreaming) return
    setDraft('')
    void send(text)
  }

  const startNew = () => {
    reset()
    setDraft('')
  }

  return (
    <>
      <AnimatePresence>
        {open ? (
          <motion.div
            key="agent-scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 z-30 bg-black/25"
            onClick={onClose}
          />
        ) : null}
      </AnimatePresence>
      <motion.aside
      initial={{ x: '100%' }}
      animate={{ x: open ? 0 : '100%' }}
      transition={{ type: 'tween', duration: 0.28, ease: 'easeOut' }}
      className="absolute inset-y-0 right-0 z-40 flex w-[440px] max-w-[86%] flex-col border-l border-border bg-card shadow-retool-lg"
      aria-hidden={!open}
    >
      {/* Header */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-5">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <Bot className="h-4 w-4 text-primary-foreground" />
          </span>
          <p className="text-sm font-bold text-foreground">{t('agent.title')}</p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={startNew}
            aria-label={t('agent.newConversation')}
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Plus className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('actions.close')}
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Threads */}
      {threads.length > 0 ? (
        <div className="flex shrink-0 gap-1.5 overflow-x-auto border-b border-border px-4 py-2">
          {threads.map((thread) => (
            <button
              key={thread.id}
              type="button"
              onClick={() => selectThread(thread.id)}
              className={cn(
                'max-w-[180px] shrink-0 truncate rounded-full px-3 py-1 text-xs transition-colors',
                thread.id === threadId
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:text-foreground',
              )}
            >
              {thread.title}
            </button>
          ))}
        </div>
      ) : null}

      {/* Body */}
      <ScrollArea
        ref={bodyRef}
        className="flex-1 [--scroll-edge-color:hsl(var(--card))]"
        contentClassName="space-y-3 p-5"
        label={t('agent.title')}
      >
        {messages.length === 0 ? (
          <p className="rounded-2xl rounded-bl-md bg-muted px-4 py-2.5 text-sm leading-relaxed text-muted-foreground">
            {t('agent.welcome')}
          </p>
        ) : null}

        {messages.map((message) => (
          <div key={message.id} className={cn('flex', message.role === 'user' ? 'justify-end' : 'justify-start')}>
            <div
              className={cn(
                'max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
                message.role === 'user'
                  ? 'rounded-br-md bg-primary text-primary-foreground'
                  : 'rounded-bl-md bg-muted text-foreground',
                message.streaming === true ? 'opacity-90' : '',
              )}
            >
              {message.text}
            </div>
          </div>
        ))}

        {isStreaming && messages.at(-1)?.streaming !== true ? (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-md bg-muted px-4 py-2.5 text-sm text-muted-foreground">
              {t('agent.thinking')}
            </div>
          </div>
        ) : null}

        {error !== null ? (
          <div className="flex items-start justify-between gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
            <span>{error}</span>
            <Trash2
              className="h-4 w-4 shrink-0 cursor-pointer opacity-70 hover:opacity-100"
              aria-label={t('actions.close')}
              onClick={() => reset()}
            />
          </div>
        ) : null}
      </ScrollArea>

      {/* Composer */}
      <div className="shrink-0 border-t border-border p-4">
        <div className="flex items-center gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit()
            }}
            placeholder={t('agent.placeholder')}
            className="h-10 flex-1 rounded-xl border border-border bg-background px-4 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/50"
          />
          <Button size="icon" aria-label={t('agent.send')} onClick={submit} disabled={!draft.trim() || isStreaming}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
      </motion.aside>
    </>
  )
}