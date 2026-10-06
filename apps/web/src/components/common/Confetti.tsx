import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'

/** Colours drawn from the brand palette so the burst never clashes with the theme. */
const COLORS = ['#16a34a', '#22c55e', '#f59e0b', '#0ea5e9', '#eab308', '#84cc16']

interface Piece {
  id: number
  x: number
  delay: number
  duration: number
  drift: number
  rotation: number
  scale: number
  color: string
  round: boolean
  tall: boolean
}

export interface ConfettiProps {
  /**
   * Increment to fire a burst. The component only reacts when the number changes,
   * so the caller owns the trigger: `setBurst((n) => n + 1)`.
   */
  fire: number
  /** Pieces per burst. Lower it if the effect feels busy. */
  pieces?: number
  /** How long a piece takes to fall, in seconds. */
  duration?: number
  /** Origin as a viewport percentage, so it can burst from a button. */
  originX?: number
  originY?: number
}

/**
 * Celebratory confetti burst for a successful outcome.
 *
 * Deliberately imperative-free: it renders nothing until `fire` changes, cleans
 * itself up, and collapses to a no-op when the visitor asked for reduced motion.
 */
export function Confetti({ fire, pieces = 90, duration = 2.6, originX = 50, originY = 22 }: ConfettiProps) {
  const reduceMotion = useReducedMotion()
  const [visible, setVisible] = useState<number | null>(null)

  useEffect(() => {
    if (fire === 0 || reduceMotion) return
    setVisible(fire)
    const timer = window.setTimeout(() => setVisible(null), duration * 1000 + 400)
    return () => window.clearTimeout(timer)
  }, [fire, duration, reduceMotion])

  const batch = useMemo<Piece[]>(() => {
    if (visible === null) return []
    return Array.from({ length: pieces }, (_, index) => ({
      id: index,
      // Spread across the width with a little jitter so it never looks like a grid.
      x: Math.random() * 100,
      delay: Math.random() * 0.35,
      duration: duration * (0.7 + Math.random() * 0.5),
      drift: (Math.random() - 0.5) * 120,
      rotation: 360 + Math.round(Math.random() * 720),
      scale: 0.6 + Math.random() * 0.8,
      color: COLORS[Math.floor(Math.random() * COLORS.length)] ?? COLORS[0],
      round: Math.random() > 0.6,
      tall: Math.random() > 0.7,
    }))
  }, [visible, pieces, duration])

  if (reduceMotion) return null

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[100] overflow-hidden">
      <AnimatePresence>
        {visible !== null ? (
          <div key={visible} className="absolute inset-0">
            {batch.map((piece) => (
              <motion.span
                key={`${visible}-${piece.id}`}
                initial={{ x: `${originX}%`, y: `${originY}vh`, opacity: 0, scale: 0, rotate: 0 }}
                animate={{
                  x: `calc(${originX}% + ${piece.drift}px)`,
                  y: '105vh',
                  opacity: [0, 1, 1, 0],
                  scale: [0, piece.scale, piece.scale, 0.4],
                  rotate: piece.rotation,
                }}
                exit={{ opacity: 0 }}
                transition={{
                  duration: piece.duration,
                  delay: piece.delay,
                  ease: [0.2, 0.6, 0.4, 1],
                  times: [0, 0.08, 0.85, 1],
                }}
                style={{ backgroundColor: piece.color }}
                className={[
                  'absolute top-0 h-2.5 w-2',
                  piece.round ? 'rounded-full' : piece.tall ? 'h-4 w-1.5 rounded-[1px]' : 'rounded-[1px]',
                ].join(' ')}
              />
            ))}
          </div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}