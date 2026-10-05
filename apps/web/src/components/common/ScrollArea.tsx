import { forwardRef, useEffect, useRef, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface ScrollAreaProps {
  children: ReactNode
  /** Classes for the outer positioning wrapper. */
  className?: string
  /** Classes for the scrollable viewport. */
  viewportClassName?: string
  /** Classes for the inner content wrapper. Omit to render children unwrapped. */
  contentClassName?: string
  /** Animate scrollTop changes on the viewport. */
  smooth?: boolean
  /** Exposes the element as a labelled landmark for screen readers. */
  label?: string
}

/**
 * Scroll container with directional edge fades.
 *
 * The wrapper carries `data-scroll-top` / `data-scroll-bottom` so the CSS in
 * `styles/scrollbar.css` can fade whichever edge still hides content. Those
 * attributes are written straight to the DOM from a rAF-throttled listener, so
 * scrolling never triggers a React render.
 */
export const ScrollArea = forwardRef<HTMLDivElement, ScrollAreaProps>(function ScrollArea(
  { children, className, viewportClassName, contentClassName, smooth = false, label },
  ref,
) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const wrapper = wrapperRef.current
    const viewport = viewportRef.current
    if (!wrapper || !viewport) return

    let frame = 0

    const sync = () => {
      frame = 0
      const maxScroll = viewport.scrollHeight - viewport.clientHeight
      wrapper.toggleAttribute('data-scroll-top', viewport.scrollTop > 1)
      wrapper.toggleAttribute('data-scroll-bottom', maxScroll - viewport.scrollTop > 1)
    }

    const schedule = () => {
      if (frame === 0) frame = window.requestAnimationFrame(sync)
    }

    const observeChildren = () => {
      resizeObserver.disconnect()
      resizeObserver.observe(viewport)
      for (const child of viewport.children) resizeObserver.observe(child)
    }

    const resizeObserver = new ResizeObserver(schedule)
    const mutationObserver = new MutationObserver(() => {
      observeChildren()
      schedule()
    })

    sync()
    observeChildren()
    mutationObserver.observe(viewport, { childList: true, subtree: true, characterData: true })
    viewport.addEventListener('scroll', schedule, { passive: true })

    return () => {
      if (frame !== 0) window.cancelAnimationFrame(frame)
      viewport.removeEventListener('scroll', schedule)
      resizeObserver.disconnect()
      mutationObserver.disconnect()
    }
  }, [])

  return (
    <div ref={wrapperRef} className={cn('scroll-area', className)}>
      <div
        ref={(node) => {
          viewportRef.current = node
          if (typeof ref === 'function') ref(node)
          else if (ref) ref.current = node
        }}
        className={cn(
          'scroll-area__viewport scrollbar-lift',
          smooth && 'scroll-smooth',
          viewportClassName,
        )}
        {...(label ? { role: 'region', 'aria-label': label } : null)}
      >
        {contentClassName ? <div className={contentClassName}>{children}</div> : children}
      </div>
      <div className="scroll-area__fade scroll-area__fade--top" aria-hidden="true" />
      <div className="scroll-area__fade scroll-area__fade--bottom" aria-hidden="true" />
    </div>
  )
})
