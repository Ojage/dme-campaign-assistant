import { useTranslation } from 'react-i18next'
import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react'
import { motion } from 'framer-motion'
import type { Insight } from '../lib/channelInsights'
import { summarise } from '../lib/channelInsights'
import { cn } from '@/lib/utils'

const SEVERITY = {
  pass: { icon: CheckCircle2, className: 'text-success', labelKey: 'preview.checks.pass' },
  warn: { icon: AlertTriangle, className: 'text-warning', labelKey: 'preview.checks.warn' },
  fail: { icon: XCircle, className: 'text-destructive', labelKey: 'preview.checks.fail' },
} as const

interface QualityChecklistProps {
  insights: Insight[]
}

/**
 * Read-only report of what the preview detected. Each row states a measured fact
 * about the copy, so nothing here needs the campaign to be regenerated.
 */
export function QualityChecklist({ insights }: QualityChecklistProps) {
  const { t, i18n } = useTranslation('campaigns')
  const totals = summarise(insights)

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
        <h4 className="text-sm font-semibold text-foreground">{t('preview.checks.title')}</h4>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-success">{t('preview.checks.passed', { count: totals.passed })}</span>
          {totals.warnings > 0 ? <span className="text-warning">{t('preview.checks.warnings', { count: totals.warnings })}</span> : null}
          {totals.failures > 0 ? <span className="text-destructive">{t('preview.checks.failures', { count: totals.failures })}</span> : null}
        </div>
      </div>

      <ul className="divide-y divide-border">
        {insights.map((insight, index) => {
          const { icon: Icon, className, labelKey } = SEVERITY[insight.severity]
          const values = insight.values ?? {}
          // Each check can word itself differently per severity, so fall back to
          // the neutral wording when a variant has no translation.
          const preferred = `preview.insights.${insight.id}.${insight.severity === 'pass' ? 'detail' : `detail${insight.severity === 'warn' ? 'Warn' : 'Fail'}`}`
          const detailKey = i18n.exists(preferred) ? preferred : `preview.insights.${insight.id}.detail`
          return (
            <motion.li
              key={insight.id}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.04 }}
              className="flex items-start gap-2.5 px-4 py-2.5"
            >
              <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', className)} aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-foreground">
                  {t(`preview.insights.${insight.id}.label`, values)}
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{t(detailKey, values)}</p>
              </div>
              <span className={cn('shrink-0 text-[10px] font-semibold uppercase tracking-wide', className)}>
                {t(labelKey)}
              </span>
            </motion.li>
          )
        })}
      </ul>

      <p className="border-t border-border px-4 py-2.5 text-[11px] text-muted-foreground">
        {t('preview.checks.disclaimer')}
      </p>
    </div>
  )
}