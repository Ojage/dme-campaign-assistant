import { useCallback, useState } from 'react'
import { MIN_PASSWORD_LENGTH } from '@/features/auth/api/authApi'
import { useAuth } from '@/features/auth/hooks/useAuth'
import type { AuthErrorCode } from '@/features/auth/types/auth.types'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type FieldKey = 'email' | 'password'
type FieldErrors = Partial<Record<FieldKey, AuthErrorCode | 'required' | 'format' | 'tooShort'>>

const EMPTY = { email: '', password: '' }

/**
 * Sign-in form logic: client-side validation, the server error code, and the
 * loading flag. Keeps the page component free of any state.
 */
export function useSignIn() {
  const { signIn } = useAuth()
  const [values, setValues] = useState(EMPTY)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<AuthErrorCode | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const setField = useCallback((key: FieldKey, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }))
    setFieldErrors((prev) => ({ ...prev, [key]: undefined }))
    setFormError(null)
  }, [])

  const validate = useCallback((): FieldErrors => {
    const errors: FieldErrors = {}
    const email = values.email.trim()

    if (email.length === 0) errors.email = 'required'
    else if (!EMAIL_PATTERN.test(email)) errors.email = 'format'

    if (values.password.length === 0) errors.password = 'required'
    else if (values.password.length < MIN_PASSWORD_LENGTH) errors.password = 'tooShort'

    return errors
  }, [values])

  const submit = useCallback(async (): Promise<boolean> => {
    const errors = validate()
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return false

    setIsSubmitting(true)
    setFormError(null)
    try {
      const code = await signIn({ email: values.email.trim(), password: values.password })
      if (code !== null) {
        setFormError(code)
        return false
      }
      setValues(EMPTY)
      return true
    } finally {
      setIsSubmitting(false)
    }
  }, [signIn, validate, values])

  const reset = useCallback(() => {
    setValues(EMPTY)
    setFieldErrors({})
    setFormError(null)
  }, [])

  return { values, setField, fieldErrors, formError, isSubmitting, submit, reset }
}
