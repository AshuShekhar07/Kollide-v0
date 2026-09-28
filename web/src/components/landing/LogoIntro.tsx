import { stagger, useAnimate, useReducedMotion, type AnimationSequence } from 'motion/react'
import { useEffect, useRef } from 'react'
import { EASE_OUT, STICK_REST } from './motion'
import Wordmark from './Wordmark'

const EASE_IN = [0.55, 0, 0.85, 0.35] as const

// Seconds into the timeline at which the second swing lands.
const HIT = 1.95
const WIPE_AT = 2.6

/**
 * Full-screen splash: the wordmark assembles, the two dandiya sticks tap and
 * then hit, and the overlay wipes upward to reveal the page. Any click, tap
 * or key skips it. `onReveal` fires as the page starts to show, `onDone` once
 * the overlay is gone.
 */
export default function LogoIntro({ onReveal, onDone }: { onReveal: () => void; onDone: () => void }) {
  const [scope, animate] = useAnimate<HTMLDivElement>()
  const reduced = useReducedMotion()
  const callbacks = useRef({ onReveal, onDone })

  useEffect(() => {
    callbacks.current = { onReveal, onDone }
  })

  useEffect(() => {
    const root = document.documentElement
    const prevOverflow = root.style.overflow
    root.style.overflow = 'hidden'

    let finished = false
    let revealed = false
    const reveal = () => {
      if (revealed) return
      revealed = true
      callbacks.current.onReveal()
    }
    const finish = () => {
      if (finished) return
      finished = true
      reveal()
      root.style.overflow = prevOverflow
      callbacks.current.onDone()
    }

    if (reduced) {
      const timer = window.setTimeout(() => {
        reveal()
        animate(scope.current, { opacity: 0 }, { duration: 0.4 }).then(finish)
      }, 700)
      return () => {
        window.clearTimeout(timer)
        root.style.overflow = prevOverflow
      }
    }

    const L = '[data-wm="stick-left"]'
    const R = '[data-wm="stick-right"]'
    const pivot = { originX: 0.5, originY: 1 }
    const rest = STICK_REST

    const sequence: AnimationSequence = [
      // Pivot the sticks at their bottom centre and hold them apart.
      [L, { ...pivot, rotate: -17 }, { duration: 0, at: 0 }],
      [R, { ...pivot, rotate: 17 }, { duration: 0, at: 0 }],
      ['[data-wm="spark"]', { ...pivot, scale: 0.2 }, { duration: 0, at: 0 }],

      // 1. Letters rise in, left to right.
      [
        '[data-wm="letter"]',
        { opacity: [0, 1], y: [70, 0] },
        { duration: 0.7, delay: stagger(0.09), ease: EASE_OUT, at: 0.05 },
      ],

      // 2. Sticks fade in, held apart.
      [L, { opacity: [0, 1] }, { duration: 0.35, at: 0.4 }],
      [R, { opacity: [0, 1] }, { duration: 0.35, at: 0.4 }],

      // 3. A slow swing in and a tap…
      [L, { rotate: rest.left }, { duration: 0.55, ease: EASE_IN, at: 0.85 }],
      [R, { rotate: rest.right }, { duration: 0.55, ease: EASE_IN, at: 0.85 }],
      // …a little bounce apart…
      [L, { rotate: -8 }, { duration: 0.22, ease: EASE_OUT, at: 1.4 }],
      [R, { rotate: 8 }, { duration: 0.22, ease: EASE_OUT, at: 1.4 }],
      // …and the real hit.
      [L, { rotate: rest.left }, { duration: 0.33, ease: EASE_IN, at: HIT - 0.33 }],
      [R, { rotate: rest.right }, { duration: 0.33, ease: EASE_IN, at: HIT - 0.33 }],

      // 4. Recoil shiver, glow and spark on the hit.
      [L, { rotate: [rest.left, rest.left - 2.2, rest.left + 1, rest.left] }, { duration: 0.28, at: HIT }],
      [R, { rotate: [rest.right, rest.right + 2.2, rest.right - 1, rest.right] }, { duration: 0.28, at: HIT }],
      [
        '[data-wm="glow"]',
        { opacity: [0, 1, 0.45, 0], scale: [0.4, 1.3, 1.05, 1] },
        { duration: 0.9, ease: 'easeOut', at: HIT },
      ],
      [
        '[data-wm="spark"]',
        { opacity: [0, 1, 1], scale: [0.2, 1.25, 1] },
        { duration: 0.45, ease: EASE_OUT, at: HIT },
      ],

      // 5. Hold, then lift the overlay away.
      ['[data-intro="logo"]', { y: -60, opacity: 0 }, { duration: 0.7, ease: [0.65, 0, 0.35, 1], at: WIPE_AT }],
      [
        scope.current,
        { clipPath: ['inset(0% 0% 0% 0%)', 'inset(0% 0% 100% 0%)'] },
        { duration: 0.9, ease: [0.76, 0, 0.24, 1], at: WIPE_AT },
      ],
    ]

    const controls = animate(sequence)
    controls.then(finish)
    const revealTimer = window.setTimeout(reveal, (WIPE_AT + 0.25) * 1000)

    const skip = () => {
      if (finished) return
      controls.stop()
      window.clearTimeout(revealTimer)
      reveal()
      animate(scope.current, { opacity: 0 }, { duration: 0.3 }).then(finish)
    }
    window.addEventListener('pointerdown', skip)
    window.addEventListener('keydown', skip)

    return () => {
      controls.stop()
      window.clearTimeout(revealTimer)
      window.removeEventListener('pointerdown', skip)
      window.removeEventListener('keydown', skip)
      root.style.overflow = prevOverflow
    }
  }, [animate, scope, reduced])

  return (
    <div
      ref={scope}
      className="fixed inset-0 z-50 flex cursor-pointer items-center justify-center bg-[#FFF4E4] px-6"
      style={{ clipPath: 'inset(0% 0% 0% 0%)' }}
      aria-hidden
    >
      <div data-intro="logo" className="w-full max-w-[640px]">
        <Wordmark intro={!reduced} className="h-auto w-full" />
      </div>
      <p className="absolute bottom-[max(env(safe-area-inset-bottom),1.5rem)] text-xs font-medium tracking-wide text-[#2A0E1B]/40">
        Tap to skip
      </p>
    </div>
  )
}
