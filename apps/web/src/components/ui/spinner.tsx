import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface SpinnerProps {
  className?: string
}

/** Indeterminate activity indicator. */
export function Spinner({ className }: SpinnerProps) {
  return <Loader2 role="status" aria-label="Loading" className={cn('h-4 w-4 animate-spin', className)} />
}
