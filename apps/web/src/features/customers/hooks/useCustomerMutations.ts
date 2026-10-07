import { useCallback, useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ApiError } from '@dme/contracts/http'
import type { ErrorCode } from '@dme/contracts/http'
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

/** The outcome of submitting a new customer, so a dialog can branch on why it failed. */
export type SubmitNewCustomerResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly code?: ErrorCode }

/**
 * Write-path logic shared by the add dialog and the CSV importer.
 *
 * Both mutations invalidate the customers caches on success. That replaces the
 * previous cross-component refresh event: a write made anywhere updates the table,
 * the KPIs and the dashboard because they all read the same queries.
 *
 * `error` merges the API failure with any message a dialog set locally (for
 * example "pick a file"), so a component renders one error slot either way.
 *
 * `setError`, `resetOutcome` and the submit functions are stable (useCallback),
 * so a dialog can hold them in an effect dependency array without that effect
 * re-running on every render — which previously reset the form state in a loop.
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
    async (input: NewCustomerPayload): Promise<SubmitNewCustomerResult> => {
      setLocalError(null)
      try {
        await createMutation.mutateAsync(input)
        return { ok: true }
      } catch (caught) {
        // Surfaced through `error`; the dialog keeps its input for the retry. The
        // code lets the dialog show a specific message (a duplicate email) instead of
        // a generic one.
        const code = caught instanceof ApiError ? caught.code : undefined
        return { ok: false, code }
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
  const errorCode = apiError instanceof ApiError ? apiError.code : null

  const error = useMemo(() => {
    if (localError !== null) return localError
    return apiError instanceof Error ? apiError.message : null
  }, [apiError, localError])

  /** Clears the merged error slot, including any pending mutation failure. */
  const setError = useCallback(
    (message: string | null) => {
      setLocalError(message)
      createMutation.reset()
      importMutation.reset()
    },
    [createMutation, importMutation],
  )

  const resetOutcome = useCallback(() => setOutcome(null), [])

  return {
    isSubmitting: createMutation.isPending || importMutation.isPending,
    error,
    /** Machine-readable code of the current API failure, for code-specific messages. */
    errorCode,
    /** Accepts a local code, or `null` to clear the current failure. */
    setError,
    importOutcome: outcome,
    resetOutcome,
    submitNewCustomer,
    submitImport,
  }
}