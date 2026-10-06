import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Check, ChevronDown, Copy, Radar, RotateCw } from 'lucide-react'
import { Button } from '@/components/common/Button'
import { RoutePath } from '@/app/router/RoutePaths'
import { cn } from '@/lib/utils'

export interface ErrorBoundaryFallbackProps {
  error: Error
  componentStack?: string | null
  onReset?: () => void
  /** `root` fills the viewport (outermost boundary); `content` fits inside the app panel. */
  layout?: 'root' | 'content'
  title?: string
  description?: string
  /** Defaults to DEV: developers see the trace from the start, production stays simple. */
  showDevDetails?: boolean
}

/**
 * Branded crash screen for the error boundary. Normal users get a reassuring
 * headline, a retry button and (below the panel) a way back; developers get a
 * collapsible trace with the message, the component stack and a copy button.
 * The middle of the panel is reserved for the logo so a crash still reads as
 * this product, not as a generic browser error.
 */
export function ErrorBoundaryFallback({
  error,
  componentStack,
  onReset,
  layout = 'root',
  title,
  description,
  showDevDetails = import.meta.env.DEV,
}: ErrorBoundaryFallbackProps) {
  const { t } = useTranslation('common')
  const navigate = useNavigate()
  const [copied, setCopied] = useState(false)

  const trace = [
    `${error.name}: ${error.message}`,
    componentStack ? `\nComponent stack:\n${componentStack}` : '',
    error.stack ? `\nStack:\n${error.stack}` : '',
  ].join('')

  const copyTrace = async () => {
    try {
      await navigator.clipboard.writeText(trace)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard unavailable (e.g. insecure context) — leave the trace on screen.
    }
  }

  const canCopy = typeof navigator !== 'undefined' && Boolean(navigator.clipboard?.writeText)

  return (
    <div
      role="alert"
      className={cn(
        layout === 'root' ? 'flex min-h-dvh items-center justify-center overflow-auto bg-background p-6' : 'flex min-h-[60vh] items-center justify-center p-6',
      )}
    >
      <div className="flex w-full max-w-lg flex-col items-center gap-5 rounded-2xl border border-border bg-card p-8 text-center shadow-retool-lg">
        {/* Brand mark — same oxblood radar tile as the top bar, on the card surfaces. */}
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-bar text-bar-foreground">
          <Radar className="h-5 w-5" />
        </span>

        <AlertTriangle className="h-8 w-8 text-destructive" aria-hidden />

        <div className="space-y-1.5">
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            {title ?? t('errors.boundary.title')}
          </h1>
          <p className="mx-auto max-w-sm text-sm text-muted-foreground">
            {description ?? t('errors.boundary.description')}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button size="md" leftIcon={<RotateCw className="h-4 w-4" />} onClick={onReset}>
            {t('actions.retry')}
          </Button>
          {layout === 'root' ? (
            <Button variant="ghost" size="md" onClick={() => navigate(RoutePath.DASHBOARD)}>
              {t('errors.boundary.backHome')}
            </Button>
          ) : null}
        </div>

        {showDevDetails ? (
          <details className="group w-full rounded-xl border border-border bg-muted/40" open={import.meta.env.DEV}>
            <summary className="flex cursor-pointer select-none items-center justify-between gap-2 px-4 py-3 text-left text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground">
              <span className="flex items-center gap-2">
                {t('errors.boundary.details')}
                {import.meta.env.DEV ? (
                  <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
                    DEV
                  </span>
                ) : null}
              </span>
              <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
            </summary>

            <div className="px-4 pb-4">
              <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-border bg-background p-3 text-left font-mono text-xs leading-relaxed text-foreground/90">
                {trace}
              </pre>
              {canCopy ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  leftIcon={copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  onClick={() => void copyTrace()}
                >
                  {copied ? t('errors.boundary.copied') : t('errors.boundary.copy')}
                </Button>
              ) : null}
            </div>
          </details>
        ) : null}

        <p className="text-xs text-muted-foreground/70">{t('app.footer')}</p>
      </div>
    </div>
  )
}