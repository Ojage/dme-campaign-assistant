import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Users } from 'lucide-react'
import { EmptyState } from '@/components/common/EmptyState'
import { Button } from '@/components/common/Button'
import { RoutePath } from '@/app/router/RoutePaths'

/**
 * Shown inside a dashboard card when there is nothing to draw yet. The one action
 * that makes any of these charts meaningful is importing customers, so every
 * empty card points at the customers page.
 */
export function ChartEmptyState() {
  const { t } = useTranslation('dashboard')
  const navigate = useNavigate()

  return (
    <div className="flex h-full min-h-56 items-center">
      <EmptyState
        icon={Users}
        title={t('empty.title')}
        description={t('empty.description')}
        action={<Button size="sm" onClick={() => navigate(RoutePath.CUSTOMERS)}>{t('empty.import')}</Button>}
      />
    </div>
  )
}