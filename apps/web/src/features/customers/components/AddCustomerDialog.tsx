import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/common/Button'
import { useCustomerMutations } from '@/features/customers/hooks/useCustomerMutations'
import { CustomerStatus, type NewCustomerPayload } from '@/features/customers/types/customer.types'

interface AddCustomerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  countries: string[]
}

type FieldKey = 'name' | 'email' | 'country' | 'transactions' | 'amount' | 'date'

const EMPTY_FORM = {
  name: '',
  email: '',
  country: '',
  status: CustomerStatus.ACTIVE,
  transactions: '0',
  amount: '0',
  date: new Date().toISOString().slice(0, 10),
}

/** Manual single-customer creation. */
export function AddCustomerDialog({ open, onOpenChange, countries }: AddCustomerDialogProps) {
  const { t } = useTranslation('customers')
  const { isSubmitting, error, setError, submitNewCustomer } = useCustomerMutations()
  const [form, setForm] = useState(EMPTY_FORM)
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldKey, string>>>({})

  useEffect(() => {
    if (open) {
      setForm(EMPTY_FORM)
      setFieldErrors({})
      setError(null)
    }
  }, [open, setError])

  const setField = (key: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setFieldErrors((prev) => ({ ...prev, [key as FieldKey]: undefined }))
  }

  const validate = (): boolean => {
    const errors: Partial<Record<FieldKey, string>> = {}
    if (form.name.trim().length === 0) errors.name = t('add.validation.name')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errors.email = t('add.validation.email')
    if (!form.country) errors.country = t('add.validation.country')
    if (!Number.isFinite(Number(form.transactions)) || Number(form.transactions) < 0) {
      errors.transactions = t('add.validation.transactions')
    }
    if (!Number.isFinite(Number(form.amount)) || Number(form.amount) < 0) errors.amount = t('add.validation.amount')
    if (!form.date || Number.isNaN(new Date(form.date).getTime())) errors.date = t('add.validation.date')
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  const submit = async () => {
    if (!validate()) return
    const payload: NewCustomerPayload = {
      name: form.name,
      email: form.email,
      country: form.country,
      status: form.status,
      totalTransactions: Number(form.transactions),
      totalAmountSpent: Number(form.amount),
      lastActivityDate: form.date,
    }
    const ok = await submitNewCustomer(payload)
    if (!ok) return
    toast.success(t('add.success', { name: payload.name }))
    onOpenChange(false)
  }

  const errorText = (key: FieldKey) =>
    fieldErrors[key] ? (
      <p className="text-xs text-destructive">{fieldErrors[key]}</p>
    ) : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('add.title')}</DialogTitle>
          <DialogDescription>{t('add.description')}</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <label htmlFor="add-name" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t('add.name')}
            </label>
            <Input id="add-name" value={form.name} onChange={(e) => setField('name', e.target.value)} placeholder={t('add.namePlaceholder')} />
            {errorText('name')}
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <label htmlFor="add-email" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t('add.email')}
            </label>
            <Input id="add-email" type="email" value={form.email} onChange={(e) => setField('email', e.target.value)} placeholder={t('add.emailPlaceholder')} />
            {errorText('email')}
          </div>
          <div className="space-y-1.5">
            <label htmlFor="add-country" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t('add.country')}
            </label>
            <Select value={form.country} onValueChange={(v) => setField('country', v)}>
              <SelectTrigger id="add-country">
                <SelectValue placeholder={t('add.countryPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {countries.map((country) => (
                  <SelectItem key={country} value={country}>
                    {country}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errorText('country')}
          </div>
          <div className="space-y-1.5">
            <label htmlFor="add-status" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t('add.status')}
            </label>
            <Select value={form.status} onValueChange={(v) => setField('status', v)}>
              <SelectTrigger id="add-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.values(CustomerStatus).map((status) => (
                  <SelectItem key={status} value={status}>
                    {t(`status.${status}`, { ns: 'common' })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="add-transactions" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t('add.transactions')}
            </label>
            <Input id="add-transactions" type="number" min={0} value={form.transactions} onChange={(e) => setField('transactions', e.target.value)} />
            {errorText('transactions')}
          </div>
          <div className="space-y-1.5">
            <label htmlFor="add-amount" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t('add.amount')}
            </label>
            <Input id="add-amount" type="number" min={0} value={form.amount} onChange={(e) => setField('amount', e.target.value)} />
            {errorText('amount')}
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <label htmlFor="add-date" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t('add.lastActivity')}
            </label>
            <Input id="add-date" type="date" value={form.date} onChange={(e) => setField('date', e.target.value)} />
            {errorText('date')}
          </div>
        </div>

        {error ? (
          <p className="text-sm text-destructive">
            {error === 'duplicate' ? t('add.validation.emailTaken') : t('add.validation.email')}
          </p>
        ) : null}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t('actions.cancel', { ns: 'common' })}
          </Button>
          <Button isLoading={isSubmitting} onClick={() => void submit()}>
            {isSubmitting ? t('add.submitting') : t('add.submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
