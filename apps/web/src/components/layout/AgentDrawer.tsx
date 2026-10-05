import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AnimatePresence, motion } from 'framer-motion'
import { Bot, Send, X } from 'lucide-react'
import { Button } from '@/components/common/Button'
import { ScrollArea } from '@/components/common/ScrollArea'
import { cn } from '@/lib/utils'

interface AgentMessage {
  id: string
  role: 'agent' | 'user'
  text: string
}

let replyIndex = 0

/**
 * Agent drawer. Slides in from the right edge of the child panel — its parent —
 * so it reads as part of the dashboard surface rather than a system overlay.
 */
export function AgentDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation('common')
  const [messages, setMessages] = useState<AgentMessage[]>([])
  const [draft, setDraft] = useState('')
  const [isThinking, setIsThinking] = useState(false)
  const bodyRef = useRef<HTMLDivElement>(null)

  // Reset the conversation each time the drawer opens, in the active language.
  useEffect(() => {
    if (open) {
      replyIndex = 0
      setMessages([{ id: `msg-${Date.now()}`, role: 'agent', text: t('agent.welcome') }])
      setDraft('')
    }
  }, [open, t])

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, isThinking])

  const send = () => {
    const text = draft.trim()
    if (!text || isThinking) return
    setMessages((prev) => [...prev, { id: `msg-${Date.now()}-u`, role: 'user', text }])
    setDraft('')
    setIsThinking(true)
    window.setTimeout(() => {
      const reply = t(`agent.replies.${replyIndex % 3}`)
      replyIndex += 1
      setMessages((prev) => [...prev, { id: `msg-${Date.now()}-a`, role: 'agent', text: reply }])
      setIsThinking(false)
    }, 800)
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
        <button
          type="button"
          onClick={onClose}
          aria-label={t('actions.close')}
          className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Body */}
      <ScrollArea
        ref={bodyRef}
        className="flex-1 [--scroll-edge-color:hsl(var(--card))]"
        contentClassName="space-y-3 p-5"
        label={t('agent.title')}
      >
        {messages.map((message) => (
          <div key={message.id} className={cn('flex', message.role === 'user' ? 'justify-end' : 'justify-start')}>
            <div
              className={cn(
                'max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
                message.role === 'user'
                  ? 'rounded-br-md bg-primary text-primary-foreground'
                  : 'rounded-bl-md bg-muted text-foreground',
              )}
            >
              {message.text}
            </div>
          </div>
        ))}
        {isThinking ? (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-md bg-muted px-4 py-2.5 text-sm text-muted-foreground">
              {t('agent.thinking')}
            </div>
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
              if (e.key === 'Enter') send()
            }}
            placeholder={t('agent.placeholder')}
            className="h-10 flex-1 rounded-xl border border-border bg-background px-4 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/50"
          />
          <Button size="icon" aria-label={t('agent.send')} onClick={send} disabled={!draft.trim() || isThinking}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
      </motion.aside>
    </>
  )
}
