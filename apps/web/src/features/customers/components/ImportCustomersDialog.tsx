import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FileUp } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/common/Button'
import { ScrollArea } from '@/components/common/ScrollArea'
import { parseCustomersCsv } from '@/utils/customerCsv'
import { useCustomerMutations } from '@/features/customers/hooks/useCustomerMutations'
import type { NewCustomerPayload } from '@/features/customers/types/customer.types'

interface ImportCustomersDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface ParsedBatch {
  fileName: string
  rows: NewCustomerPayload[]
  rowLines: number[]
}

/** Bulk CSV import with per-row error reporting. */
export function ImportCustomersDialog({ open, onOpenChange }: ImportCustomersDialogProps) {
  const { t } = useTranslation('customers')
  const { isSubmitting, error, setError, importOutcome, resetOutcome, submitImport } = useCustomerMutations()
  const [batch, setBatch] = useState<ParsedBatch | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setBatch(null)
      resetOutcome()
      setError(null)
    }
  }, [open, resetOutcome, setError])

  const handleFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : ''
      const parsed = parseCustomersCsv(text)
      setBatch({
        fileName: file.name,
        rows: parsed.rows,
        rowLines: parsed.rowLines,
      })
      resetOutcome()
      setError(null)
    }
    reader.readAsText(file)
  }

  const submit = async () => {
    if (!batch) {
      setError('noFile')
      return
    }
    await submitImport(batch.rows, batch.rowLines)
  }

  const summaryText = importOutcome
    ? [
        importOutcome.imported > 0 ? t('import.imported', { n: importOutcome.imported }) : null,
        importOutcome.duplicates > 0 ? t('import.duplicates', { n: importOutcome.duplicates }) : null,
        importOutcome.invalid.length > 0 ? t('import.invalid', { n: importOutcome.invalid.length }) : null,
      ]
        .filter(Boolean)
        .join(' ')
    : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('import.title')}</DialogTitle>
          <DialogDescription>{t('import.description')}</DialogDescription>
        </DialogHeader>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-muted/30 p-8 text-center transition-colors hover:bg-muted/60"
        >
          <FileUp className="h-8 w-8 text-primary" />
          <span className="text-sm font-semibold text-foreground">{t('import.chooseFile')}</span>
          <span className="max-w-sm text-xs text-muted-foreground">{t('import.fileHint')}</span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleFile(file)
            e.target.value = ''
          }}
        />

        {batch ? (
          <p className="text-sm text-muted-foreground">
            {t('import.selectedFile', { name: batch.fileName, n: batch.rows.length })}
          </p>
        ) : null}

        {error === 'noFile' ? <p className="text-sm text-destructive">{t('import.noFile')}</p> : null}

        {summaryText ? <p className="text-sm font-medium text-success">{summaryText}</p> : null}

        {importOutcome && importOutcome.invalid.length > 0 ? (
          <ScrollArea
            className="max-h-40 rounded-lg border border-border bg-muted/30 [--scroll-edge-color:hsl(var(--muted))]"
            contentClassName="space-y-1 p-3"
          >
            {importOutcome.invalid.map((row) => (
              <p key={row.line} className="text-xs text-destructive">
                {t('import.invalidRow', { line: row.line, reason: t(`import.reasons.${row.reason}`) })}
              </p>
            ))}
          </ScrollArea>
        ) : null}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t('actions.close', { ns: 'common' })}
          </Button>
          <Button isLoading={isSubmitting} disabled={!batch && importOutcome === null} onClick={() => void submit()}>
            {isSubmitting ? t('import.importing') : t('import.submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
