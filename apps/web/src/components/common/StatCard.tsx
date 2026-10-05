import type { LucideIcon } from 'lucide-react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface StatCardProps {
  icon: LucideIcon
  label: string
  value: string
  hint?: string
  /** 'accent' renders the value in amber — the palette's highlight color. */
  tone?: 'primary' | 'accent'
}

export function StatCard({ icon: Icon, label, value, hint, tone = 'primary' }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="rounded-xl border border-border bg-card p-5 shadow-retool-sm"
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <p
        className={cn(
          'mt-2 text-2xl font-bold tabular-nums',
          tone === 'accent' ? 'text-accent' : 'text-foreground',
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </motion.div>
  )
}
