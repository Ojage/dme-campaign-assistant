import { useEffect, useState } from 'react'
import { Toaster as SonnerToaster, type ToasterProps } from 'sonner'
import { cn } from '@/lib/utils'

type Theme = 'light' | 'dark'

/** Mirrors the `dark` class the theme hook toggles on <html>. */
function useResolvedTheme(): Theme {
  const [theme, setTheme] = useState<Theme>(() =>
    document.documentElement.classList.contains('dark') ? 'dark' : 'light',
  )

  useEffect(() => {
    const sync = () => setTheme(document.documentElement.classList.contains('dark') ? 'dark' : 'light')
    const observer = new MutationObserver(sync)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  return theme
}

export interface AppToasterProps extends ToasterProps {
  className?: string
}

/** App-level toast host, themed from the active colour scheme. */
export function Toaster({ className, ...props }: AppToasterProps) {
  const theme = useResolvedTheme()

  return (
    <SonnerToaster
      theme={theme}
      className={cn('toaster group', className)}
      toastOptions={{
        classNames: {
          toast: 'border border-border bg-card text-card-foreground shadow-retool-md',
          description: 'text-muted-foreground',
          actionButton: 'bg-primary text-primary-foreground',
          cancelButton: 'bg-muted text-muted-foreground',
        },
      }}
      style={
        {
          '--normal-bg': 'hsl(var(--card))',
          '--normal-text': 'hsl(var(--card-foreground))',
          '--normal-border': 'hsl(var(--border))',
        } as React.CSSProperties
      }
      {...props}
    />
  )
}
