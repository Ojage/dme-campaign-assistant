import { useCallback, useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { addCustomer, importCustomers } from '@/features/customers/api/customersApi'
import type { NewCustomerPayload } from '@/features/customers/types/customer.types'
import { queryKeys } from '@/lib/query/queryKeys'

export interface ImportRowError {
  /** File line number, 1-based, as the user sees it. */
  line: number
  reason: string
}

export interface ImportOutcome {
  imported: number
  duplicates: number
  invalid: ImportRowError[]
}

/**
 * Write-path logic shared by the add dialog and the CSV importer.
 *
 * Both mutations invalidate the customers caches on success. That replaces the
 * previous cross-component refresh event: a write made anywhere updates the table,
 * the KPIs and the dashboard because they all read the same queries.
 *
 * `error` merges the API failure with any message a dialog set locally (for
 * example "pick a file"), so a component renders one error slot either way.
 */
export function useCustomerMutations() {
  const queryClient = useQueryClient()
  const [outcome, setOutcome] = useState<ImportOutcome | null>(null)
  const [localError, setLocalError] = useState<string | null>(null)

  const invalidateCustomers = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.customers.all })
  }, [queryClient])

  const createMutation = useMutation({
    mutationFn: (input: NewCustomerPayload) => addCustomer(input),
    onSuccess: invalidateCustomers,
  })

  const importMutation = useMutation({
    mutationFn: (rows: Array<Partial<NewCustomerPayload>>) => importCustomers(rows),
    onSuccess: async (result) => {
      // Row numbers in the payload are 1-based positions in the submitted array.
      setOutcome({
        imported: result.imported,
        duplicates: result.duplicates,
        invalid: result.failures.map((failure) => ({ line: failure.row, reason: failure.reason })),
      })
      if (result.imported > 0) await invalidateCustomers()
    },
  })

  const submitNewCustomer = useCallback(
    async (input: NewCustomerPayload): Promise<boolean> => {
      setLocalError(null)
      try {
        await createMutation.mutateAsync(input)
        return true
      } catch {
        // Surfaced through `error`; the dialog keeps its input for the retry.
        return false
      }
    },
    [createMutation],
  )

  /**
   * `lines[i]` is the file line that produced row `i + 1`, so per-row failures
   * are reported against the line the user can actually fix.
   */
  const submitImport = useCallback(
    async (rows: Array<Partial<NewCustomerPayload>>, lines: number[]): Promise<void> => {
      setOutcome(null)
      setLocalError(null)
      try {
        const result = await importMutation.mutateAsync(rows)
        setOutcome({
          imported: result.imported,
          duplicates: result.duplicates,
          invalid: result.failures.map((failure) => ({
            line: lines[failure.row - 1] ?? failure.row,
            reason: failure.reason,
          })),
        })
        if (result.imported > 0) await invalidateCustomers()
      } catch {
        // Surfaced through `error`.
      }
    },
    [importMutation, invalidateCustomers],
  )

  const apiError = createMutation.error ?? importMutation.error
  const error = useMemo(() => localError ?? (apiError instanceof Error ? apiError.message : null), [apiError, localError])

  return {
    isSubmitting: createMutation.isPending || importMutation.isPending,
    error,
    /** Accepts a local code, or `null` to clear the current failure. */
    setError: (message: string | null) => {
      setLocalError(message)
      createMutation.reset()
      importMutation.reset()
    },
    importOutcome: outcome,
    resetOutcome: () => setOutcome(null),
    submitNewCustomer,
    submitImport,
  }
}
