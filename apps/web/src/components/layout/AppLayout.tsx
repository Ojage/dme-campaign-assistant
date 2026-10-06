import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
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
  const [navOpen, setNavOpen] = useState(false)
  const location = useLocation()

  // Cmd/Ctrl+K opens the palette from anywhere in the app.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setSearchOpen((open) => !open)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Escape closes the mobile navigation drawer; navigating closes it too.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setNavOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => setNavOpen(false), [location])

  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden bg-[hsl(var(--bar))]">
      <TopBar
        onOpenSearch={() => setSearchOpen(true)}
        onOpenAgent={() => setAgentOpen(true)}
        onToggleNav={() => setNavOpen((open) => !open)}
      />

      {/* Child panel */}
      <div className="min-h-0 flex-1 p-2 pt-1.5">
        <div className="relative flex h-full min-h-0 overflow-hidden rounded-2xl border border-black/10 bg-background shadow-retool-lg">
          <Sidebar className="hidden lg:flex" />

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

          {/* Mobile navigation drawer — takes over from the sidebar below lg */}
          <AnimatePresence>
            {navOpen ? (
              <>
                <motion.div
                  key="nav-scrim"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="absolute inset-0 z-30 bg-black/25 lg:hidden"
                  onClick={() => setNavOpen(false)}
                />
                <motion.aside
                  key="nav-drawer"
                  initial={{ x: '-100%' }}
                  animate={{ x: 0 }}
                  exit={{ x: '-100%' }}
                  transition={{ type: 'tween', duration: 0.28, ease: 'easeOut' }}
                  className="absolute inset-y-0 left-0 z-40 w-60 max-w-[80%] shadow-retool-lg lg:hidden"
                >
                  <Sidebar />
                </motion.aside>
              </>
            ) : null}
          </AnimatePresence>
        </div>
      </div>

      <Toaster position="bottom-right" />
    </div>
  )
}
