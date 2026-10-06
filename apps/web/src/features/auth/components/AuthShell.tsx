import type { ReactNode } from 'react'
import { WorldMapWatermark } from '@/components/common/WorldMapWatermark'
import { AuthTopBar } from '@/features/auth/components/AuthTopBar'

/**
 * Mirrors AppLayout's two-layer frame — oxblood bar, rounded panel below — so
 * the sign-in screen reads as part of the product rather than a separate site.
 * Deliberately omits the sidebar, search console and agent drawer: all three
 * require a session.
 */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden bg-[hsl(var(--bar))]">
      <AuthTopBar />

      <div className="min-h-0 flex-1 p-2 pt-1.5">
        <div className="relative flex h-full min-h-0 items-center justify-center overflow-hidden rounded-2xl border border-black/10 bg-background p-4 shadow-retool-lg">
          <WorldMapWatermark className="pointer-events-none absolute left-1/2 top-1/2 w-[min(880px,90%)] -translate-x-1/2 -translate-y-1/2 text-foreground opacity-[0.045] dark:opacity-[0.07]" />
          <div className="relative w-full">{children}</div>
        </div>
      </div>
    </div>
  )
}
