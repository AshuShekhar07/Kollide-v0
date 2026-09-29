import { motion, useReducedMotion } from 'motion/react'
import { useCallback, useEffect, useState, type ReactNode } from 'react'

// Marigold and rose petals falling over the screen, for the big moments:
// getting verified, a group filling up. Each moment is celebrated once per
// device.

const KEY = 'kollide:celebrated'

function celebrated(id: string) {
  try {
    return (JSON.parse(localStorage.getItem(KEY) ?? '[]') as string[]).includes(id)
  } catch {
    // Storage blocked: better to skip the petals than show them every visit.
    return true
  }
}

function markCelebrated(id: string) {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) ?? '[]') as string[]
    localStorage.setItem(KEY, JSON.stringify([...list.slice(-50), id]))
  } catch {
    // Not remembered; nothing else to do.
  }
}

const COLOURS = ['#f29f05', '#f6c33b', '#e0661a', '#f29f05', '#d4246b', '#f6c33b']

// Spread out evenly with a little jitter, so they fill the width.
const PETALS = Array.from({ length: 42 }, (_, i) => {
  const r = (n: number) => ((Math.sin(i * 12.9898 + n * 78.233) * 43758.5453) % 1 + 1) % 1
  return {
    left: (i / 42) * 100 + r(1) * 4 - 2,
    delay: r(2) * 1.4,
    duration: 2.6 + r(3) * 1.8,
    drift: (r(4) - 0.5) * 120,
    spin: (r(5) - 0.5) * 720,
    size: 10 + r(6) * 10,
    color: COLOURS[i % COLOURS.length],
  }
})

function PetalShower({ message, onDone }: { message?: ReactNode; onDone: () => void }) {
  const reduced = useReducedMotion()
  useEffect(() => {
    const t = window.setTimeout(onDone, reduced ? 2600 : 5200)
    return () => window.clearTimeout(t)
  }, [onDone, reduced])

  return (
    <div className="pointer-events-none fixed inset-0 z-[70] overflow-hidden" aria-hidden={!message}>
      {!reduced &&
        PETALS.map((p, i) => (
          <motion.span
            key={i}
            className="absolute -top-8 block rounded-[60%_0_60%_0] shadow-sm"
            style={{ left: `${p.left}%`, width: p.size, height: p.size * 0.7, backgroundColor: p.color }}
            initial={{ y: 0, x: 0, rotate: 0, opacity: 1 }}
            animate={{ y: '110vh', x: [0, p.drift, -p.drift / 2, p.drift / 3], rotate: p.spin, opacity: [1, 1, 1, 0] }}
            transition={{ duration: p.duration, delay: p.delay, ease: 'easeIn' }}
          />
        ))}
      {message && (
        <motion.div
          role="status"
          className="absolute inset-x-4 top-[max(env(safe-area-inset-top),1rem)] mx-auto w-fit max-w-sm rounded-full bg-maroon-700 px-5 py-3 text-center text-sm font-bold text-cream shadow-2xl shadow-maroon-950/40 ring-2 ring-marigold-400 lg:top-24"
          initial={{ y: -30, opacity: 0, scale: 0.9 }}
          animate={{ y: 0, opacity: [0, 1, 1, 0], scale: 1 }}
          transition={{ duration: reduced ? 2.6 : 5, times: [0, 0.08, 0.85, 1], ease: 'easeOut' }}
        >
          {message}
        </motion.div>
      )}
    </div>
  )
}

/** Petals (and an optional message) the first time `when` is true for `id`. */
export default function Celebrate({ id, when, message }: { id: string; when: boolean; message?: ReactNode }) {
  const [over, setOver] = useState<string | null>(null)
  const done = useCallback(() => {
    markCelebrated(id)
    setOver(id)
  }, [id])
  if (!when || over === id || celebrated(id)) return null
  return <PetalShower message={message} onDone={done} />
}
