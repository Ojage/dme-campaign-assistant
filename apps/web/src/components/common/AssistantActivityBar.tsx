import { useTranslation } from 'react-i18next'
import { useAssistantIsWorking } from '@/app/providers/AssistantActivityProvider'
import { cn } from '@/lib/utils'

/**
 * Page-wide activity indicator for "the assistant is working".
 *
 * A three-layer ribbon pinned to the bottom inside corners of the content area:
 *
 * 1. a blurred crimson bloom that breathes, giving the bar presence on the page;
 * 2. a faint track, so the bar reads as a fixed rail rather than a stray glint;
 * 3. a highlight that sweeps across, built as a wrapper that translates while its
 *    gradient and hot core are children — one transform, so the two layers cannot
 *    drift apart at the seam.
 *
 * Crimson comes from `--primary`, which flips with `.dark`, so no colour is
 * hard-coded here. Everything is `pointer-events-none`: the bar reports work, it
 * never intercepts a click.
 *
 * Under `prefers-reduced-motion` the bloom holds still and the sweep is removed,
 * leaving a dim static rail plus the live-region announcement below.
 */
export function AssistantActivityBar({ className }: { className?: string }) {
  const { t } = useTranslation('common')
  const working = useAssistantIsWorking()

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'pointer-events-none absolute inset-x-0 bottom-0 z-50 px-8 pb-7 transition-opacity duration-500 ease-out',
        working ? 'opacity-100' : 'opacity-0',
        className,
      )}
    >
      <span className="sr-only">{working ? t('activity.working') : ''}</span>

      {/* The rail owns the height; every layer is inset against it, so the curve and
          the glow stay concentric instead of drifting a padding apart. */}
      <div className="relative h-[3px] w-full">
        {/* 1 — bloom. Spills past the rail on every side; no z-index needed because
            it is the first positioned child and the others paint over it. */}
        <span
          aria-hidden
          className="absolute -inset-x-12 -top-6 bottom-[-16px] rounded-full bg-primary/25 blur-2xl animate-assistant-bloom motion-reduce:animate-none"
        />
        {/* 2 — track */}
        <span aria-hidden className="absolute inset-0 rounded-full bg-primary/15 ring-1 ring-inset ring-primary/10" />
        {/* 3 — sweep, clipped to the rail so the bar keeps its curve. Half the rail
            wide, which is what keeps it on-screen for the whole cycle. */}
        <span aria-hidden className="absolute inset-0 overflow-hidden rounded-full">
          <span className="absolute inset-y-0 left-0 w-1/2 animate-assistant-sweep motion-reduce:hidden">
            <span className="absolute inset-0 rounded-full bg-gradient-to-r from-transparent via-primary to-transparent blur-[3px]" />
            <span className="absolute inset-y-px left-[14%] right-[14%] rounded-full bg-gradient-to-r from-transparent via-primary-foreground to-transparent animate-assistant-core" />
          </span>
        </span>
      </div>
    </div>
  )
}