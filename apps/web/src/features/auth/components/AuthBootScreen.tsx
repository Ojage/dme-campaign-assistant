import type { ReactNode } from 'react'
import { WorldMapWatermark } from '@/components/common/WorldMapWatermark'
import { PageSkeleton } from '@/components/common/PageSkeleton'

/**
 * Shown for the single frame it takes to restore a stored session, so a refresh
 * never flashes the sign-in screen at an already-authenticated user.
 */
export function AuthBootScreen({ children }: { children?: ReactNode }) {
  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden bg-[hsl(var(--bar))]">
      <div className="h-12 shrink-0" />
      <div className="min-h-0 flex-1 p-2 pt-1.5">
        <div className="relative h-full min-h-0 overflow-hidden rounded-2xl border border-black/10 bg-background shadow-retool-lg">
          <WorldMapWatermark className="pointer-events-none absolute left-1/2 top-1/2 w-[min(880px,90%)] -translate-x-1/2 -translate-y-1/2 text-foreground opacity-[0.045] dark:opacity-[0.07]" />
          <div className="relative">{children ?? <PageSkeleton />}</div>
        </div>
      </div>
    </div>
  )
}
