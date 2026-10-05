import { useTranslation } from 'react-i18next'
import { AlertCircle, RotateCw } from 'lucide-react'
import { Button } from '@/components/common/Button'

interface ErrorMessageProps {
  message: string
  onRetry?: () => void
}

/** Error display with an optional retry action — used by every data view. */
export function ErrorMessage({ message, onRetry }: ErrorMessageProps) {
  const { t } = useTranslation('common')

  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-border bg-card p-10 text-center">
      <AlertCircle className="h-8 w-8 text-destructive" />
      <p className="text-sm font-semibold text-foreground">{t('errors.generic')}</p>
      <p className="max-w-md text-sm text-muted-foreground">{message}</p>
      {onRetry ? (
        <Button variant="outline" size="sm" leftIcon={<RotateCw className="h-4 w-4" />} onClick={onRetry}>
          {t('actions.retry')}
        </Button>
      ) : null}
    </div>
  )
}
