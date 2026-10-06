import { memo } from 'react'
import { motion } from 'framer-motion'
import { Bot } from 'lucide-react'

const dots = [0, 1, 2]

/** Bouncing-dot "thinking" indicator shown while the reply is being composed. */
export const TypingIndicator = memo(function TypingIndicator({
  label,
}: {
  label: string
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      className="flex items-start gap-2.5"
      role="status"
      aria-label={label}
    >
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/60 text-primary-foreground shadow-sm">
        <Bot className="h-4 w-4" aria-hidden="true" />
      </span>
      <span className="flex items-center gap-2.5 rounded-2xl rounded-bl-md border border-border bg-muted/50 px-4 py-3 shadow-sm">
        <span className="flex items-center gap-1" aria-hidden="true">
          {dots.map((index) => (
            <motion.span
              key={index}
              className="h-1.5 w-1.5 rounded-full bg-foreground/60"
              animate={{ y: [0, -3, 0], opacity: [0.4, 1, 0.4] }}
              transition={{
                duration: 0.9,
                repeat: Infinity,
                delay: index * 0.15,
                ease: 'easeInOut',
              }}
            />
          ))}
        </span>
        <span className="text-xs font-medium text-muted-foreground">
          {label.replace(/…$/, '').trim()}
        </span>
      </span>
    </motion.div>
  )
})