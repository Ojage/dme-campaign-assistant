import type { ReactNode } from 'react'
import { Lock, RefreshCw, ArrowLeft, ArrowRight, Plus } from 'lucide-react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

export type PreviewDevice = 'desktop' | 'mobile'

interface BrowserFrameProps {
  /** Tab and window title. */
  title: string
  /** Shown in the address bar so the frame reads as a real page. */
  url: string
  device: PreviewDevice
  children: ReactNode
}

/** Viewport widths for the two device modes. */
const VIEWPORT: Record<PreviewDevice, string> = {
  desktop: 'w-full',
  mobile: 'w-[390px]',
}

/**
 * Browser chrome around the preview.
 *
 * Purely decorative: the dots, tab and address bar exist to frame the campaign
 * the way the recipient's own window will, and none of it is interactive.
 */
export function BrowserFrame({ title, url, device, children }: BrowserFrameProps) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-all duration-300',
        device === 'mobile' && 'mx-auto max-w-[430px]',
      )}
    >
      {/* Window chrome */}
      <div className="flex items-center gap-3 border-b border-border bg-muted/60 px-3 py-2.5">
        <div className="flex shrink-0 items-center gap-1.5" aria-hidden>
          <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
          <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
          <span className="h-3 w-3 rounded-full bg-[#28c840]" />
        </div>

        {/* Tab */}
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-md border border-border bg-card px-2.5 py-1.5">
          <span className="grid h-4 w-4 shrink-0 place-items-center rounded-sm bg-primary/90 text-[9px] font-bold text-primary-foreground">
            D
          </span>
          <span className="truncate text-xs text-muted-foreground">{title}</span>
        </div>
      </div>

      {/* Address bar row */}
      <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-3 py-2">
        <div className="hidden items-center gap-1 text-muted-foreground sm:flex" aria-hidden>
          <ArrowLeft className="h-3.5 w-3.5" />
          <ArrowRight className="h-3.5 w-3.5 opacity-50" />
          <RefreshCw className="h-3.5 w-3.5" />
        </div>
        <div className="flex min-w-0 flex-1 items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1">
          <Lock className="h-3 w-3 shrink-0 text-success" aria-hidden />
          <span className="truncate text-xs text-muted-foreground">{url}</span>
        </div>
        <Plus className="hidden h-3.5 w-3.5 text-muted-foreground sm:block" aria-hidden />
      </div>

      {/* Viewport */}
      <motion.div
        layout
        transition={{ type: 'spring', stiffness: 260, damping: 30 }}
        className={cn('mx-auto overflow-hidden bg-background', VIEWPORT[device])}
      >
        {children}
      </motion.div>
    </div>
  )
}