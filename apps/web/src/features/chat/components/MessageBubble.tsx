import { memo } from 'react'
import { motion } from 'framer-motion'
import { Bot } from 'lucide-react'
import { cn } from '@/lib/utils'
import { AgentMarkdown } from '@/features/chat/components/AgentMarkdown'
import type { DisplayMessage } from '@/features/chat/types/chat.types'

/**
 * One rendered turn. User replies anchor right with brand colour; assistant replies
 * anchor left with an avatar and the Markdown pipeline, and enter with a small
 * spring so the transcript feels alive without re-animating on every stream delta
 * (the key is stable, so only the mount moves).
 */
export const MessageBubble = memo(function MessageBubble({
  message,
}: {
  message: DisplayMessage
}) {
  const isUser = message.role === 'user'

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 420, damping: 34 }}
      className={cn('flex', isUser ? 'justify-end' : 'items-start gap-2.5')}
    >
      {!isUser ? (
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/60 text-primary-foreground shadow-sm">
          <Bot className="h-4 w-4" aria-hidden="true" />
        </span>
      ) : null}

      <div
        className={cn(
          'min-w-0 max-w-[88%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
          isUser
            ? 'rounded-br-md bg-primary text-primary-foreground shadow-sm'
            : 'rounded-bl-md border border-border bg-muted/50 text-foreground shadow-sm',
          isUser ? '' : 'group',
        )}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.text}</p>
        ) : (
          <AgentMarkdown text={message.text} streaming={message.streaming} />
        )}
      </div>
    </motion.div>
  )
})