import { motion } from 'framer-motion'

const SkeletonRow = () => (
  <motion.div
    className="flex items-center gap-4 p-4 border-b border-border last:border-b-0"
    animate={{ opacity: [0.4, 0.8, 0.4] }}
    transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
  >
    <div className="h-4 rounded bg-muted w-1/5" />
    <div className="h-4 rounded bg-muted w-1/6" />
    <div className="h-4 rounded bg-muted w-1/6" />
    <div className="h-4 rounded bg-muted w-1/6" />
    <div className="h-4 rounded bg-muted w-1/8" />
  </motion.div>
)

export function CustomerTableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonRow key={i} />
      ))}
    </div>
  )
}
