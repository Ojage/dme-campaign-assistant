import { motion } from 'framer-motion'

const PulseBlock = ({ className }: { className: string }) => (
  <motion.div
    className={`rounded-md bg-muted ${className}`}
    animate={{ opacity: [0.4, 0.8, 0.4] }}
    transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
  />
)

/** Full-page loading skeleton shown while lazily-loaded route chunks arrive. */
export function PageSkeleton() {
  return (
    <div className="flex flex-col gap-6 p-8">
      <div className="flex flex-col gap-2">
        <PulseBlock className="h-7 w-56" />
        <PulseBlock className="h-4 w-80" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-5 space-y-3">
            <PulseBlock className="h-3 w-24" />
            <PulseBlock className="h-8 w-32" />
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-border bg-card">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="flex gap-4 p-4 border-b border-border last:border-b-0">
            <PulseBlock className="h-4 w-1/5" />
            <PulseBlock className="h-4 w-1/6" />
            <PulseBlock className="h-4 w-1/6" />
            <PulseBlock className="h-4 w-1/8" />
          </div>
        ))}
      </div>
    </div>
  )
}
