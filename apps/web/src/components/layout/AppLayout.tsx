import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { Toaster } from '@/components/ui/sonner'
import { Sidebar } from '@/components/layout/Sidebar'
import { TopBar } from '@/components/layout/TopBar'
import { SearchConsole } from '@/components/layout/SearchConsole'
import { AgentDrawer } from '@/components/layout/AgentDrawer'
import { ScrollArea } from '@/components/common/ScrollArea'
import { WorldMapWatermark } from '@/components/common/WorldMapWatermark'
import { AssistantActivityBar } from '@/components/common/AssistantActivityBar'

/**
 * Two-layer stack:
 * - Parent bar (oxblood) pinned to the top of the viewport — the outermost frame.
 * - Child panel below it with a large border radius; the small gap between them
 *   reveals the red, framing the panel like a mat around a print.
 * The search console and agent drawer live INSIDE the child panel, so they
 * read as part of the dashboard surface rather than system-level overlays.
 */
export function AppLayout() {
  const [searchOpen, setSearchOpen] = useState(false)
  const [agentOpen, setAgentOpen] = useState(false)

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-[hsl(var(--bar))]">
      <TopBar onOpenSearch={() => setSearchOpen(true)} onOpenAgent={() => setAgentOpen(true)} />

      {/* Child panel */}
      <div className="min-h-0 flex-1 p-2 pt-1.5">
        <div className="relative flex h-full min-h-0 overflow-hidden rounded-2xl border border-black/10 bg-background shadow-retool-lg">
          <Sidebar />

          <main className="relative min-w-0 flex-1">
            {/* Dot-matrix world map watermark — fixed behind every page */}
            <WorldMapWatermark className="pointer-events-none absolute left-1/2 top-1/2 w-[min(880px,80%)] -translate-x-1/2 -translate-y-1/2 text-foreground opacity-[0.045] dark:opacity-[0.07]" />
            <ScrollArea className="h-full" contentClassName="relative" label="Page content">
              <Outlet />
            </ScrollArea>

            {/* Spans the content area and sits above the drawer (z-50 > z-40) so a
                reply generated inside the chat still lights the whole page. */}
            <AssistantActivityBar />
          </main>

          <AnimatePresence>
            {searchOpen ? <SearchConsole key="search" onClose={() => setSearchOpen(false)} /> : null}
          </AnimatePresence>

          <AgentDrawer open={agentOpen} onClose={() => setAgentOpen(false)} />
        </div>
      </div>

      <Toaster position="bottom-right" />
    </div>
  )
}
