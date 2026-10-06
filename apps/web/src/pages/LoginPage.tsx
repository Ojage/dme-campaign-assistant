import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertCircle, Eye, EyeOff, KeyRound, LogIn, Mail, Radar } from 'lucide-react'
import { Button } from '@/components/common/Button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { AuthShell } from '@/features/auth/components/AuthShell'
import { MIN_PASSWORD_LENGTH } from '@/features/auth/api/authApi'
import { useSignIn } from '@/features/auth/hooks/useSignIn'

/**
 * Sign-in form. It never navigates itself: PublicOnly reacts to the session
 * becoming live and sends the user to the page that triggered the redirect.
 */
export default function LoginPage() {
  const { t } = useTranslation('auth')
  const { values, setField, fieldErrors, formError, isSubmitting, submit } = useSignIn()
  const [isPasswordVisible, setIsPasswordVisible] = useState(false)

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void submit()
  }

  return (
    <AuthShell>
      <div className="mx-auto flex w-full max-w-md flex-col items-center">
        {/* Brand block — the crimson seal is the only place the two accents meet */}
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary shadow-retool-md">
          <Radar className="h-6 w-6 text-primary-foreground" />
        </span>
        <h1 className="mt-4 text-2xl font-bold tracking-tight text-foreground">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('description')}</p>

        <Card className="mt-7 w-full">
          <CardContent className="p-7">
            <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-5">
              {formError ? (
                <p
                  role="alert"
                  className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm font-medium text-destructive"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  {t(`errors.${formError}`)}
                </p>
              ) : null}

              <div className="flex flex-col gap-1.5">
                <label htmlFor="auth-email" className="text-sm font-semibold text-foreground">
                  {t('email')}
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="auth-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    autoFocus
                    spellCheck={false}
                    placeholder={t('emailPlaceholder')}
                    value={values.email}
                    onChange={(event) => setField('email', event.target.value)}
                    aria-invalid={Boolean(fieldErrors.email)}
                    aria-describedby={fieldErrors.email ? 'auth-email-error' : undefined}
                    className="h-11 pl-9"
                  />
                </div>
                {fieldErrors.email ? (
                  <p id="auth-email-error" role="alert" className="text-xs font-medium text-destructive">
                    {t(`validation.${fieldErrors.email === 'format' ? 'emailFormat' : 'emailRequired'}`)}
                  </p>
                ) : null}
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="auth-password" className="text-sm font-semibold text-foreground">
                  {t('password')}
                </label>
                <div className="relative">
                  <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="auth-password"
                    name="password"
                    type={isPasswordVisible ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder={t('passwordPlaceholder')}
                    value={values.password}
                    onChange={(event) => setField('password', event.target.value)}
                    aria-invalid={Boolean(fieldErrors.password)}
                    aria-describedby={fieldErrors.password ? 'auth-password-error' : undefined}
                    className="h-11 pl-9 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setIsPasswordVisible((prev) => !prev)}
                    aria-label={isPasswordVisible ? t('hidePassword') : t('showPassword')}
                    aria-pressed={isPasswordVisible}
                    className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {isPasswordVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {fieldErrors.password ? (
                  <p id="auth-password-error" role="alert" className="text-xs font-medium text-destructive">
                    {fieldErrors.password === 'tooShort'
                      ? t('validation.passwordTooShort', { n: MIN_PASSWORD_LENGTH })
                      : t('validation.passwordRequired')}
                  </p>
                ) : null}
              </div>

              <Button
                type="submit"
                size="lg"
                isLoading={isSubmitting}
                leftIcon={<LogIn className="h-4 w-4" />}
                className="w-full"
              >
                {isSubmitting ? t('submitting') : t('submit')}
              </Button>

              {isSubmitting ? (
                <p className="-mt-2 text-center text-xs text-muted-foreground">{t('submittingHint')}</p>
              ) : null}
            </form>
          </CardContent>
        </Card>

        <p className="mt-6 text-[11px] text-muted-foreground/70">{t('footer')}</p>
      </div>
    </AuthShell>
  )
}
