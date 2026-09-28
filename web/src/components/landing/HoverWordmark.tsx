import { stagger, useAnimate, useReducedMotion, type AnimationSequence } from 'motion/react'
import { useRef } from 'react'
import { EASE_OUT, STICK_REST } from './motion'
import Wordmark from './Wordmark'

const EASE_IN = [0.55, 0, 0.85, 0.35] as const

/**
 * The wordmark that replays a short version of the logo intro on hover (or
 * keyboard focus): the letters bob, the dandiya sticks swing apart and hit
 * again, and the spark pops. A hover mid-play is ignored so it never jumps.
 */
export default function HoverWordmark({ className, tone = 'light' }: { className?: string; tone?: 'light' | 'dark' }) {
  const [scope, animate] = useAnimate<HTMLSpanElement>()
  const reduced = useReducedMotion()
  const playing = useRef(false)

  function play() {
    if (reduced || playing.current) return
    playing.current = true
    const L = '[data-wm="stick-left"]'
    const R = '[data-wm="stick-right"]'
    const pivot = { originX: 0.5, originY: 1 }
    const rest = STICK_REST
    const hit = 0.62

    const sequence: AnimationSequence = [
      [L, { ...pivot, rotate: rest.left }, { duration: 0, at: 0 }],
      [R, { ...pivot, rotate: rest.right }, { duration: 0, at: 0 }],
      ['[data-wm="spark"]', { ...pivot }, { duration: 0, at: 0 }],

      // Letters bob, left to right.
      ['[data-wm="letter"]', { y: [0, -14, 0] }, { duration: 0.55, delay: stagger(0.05), ease: 'easeInOut', at: 0 }],

      // Spark tucks away while the sticks swing apart…
      ['[data-wm="spark"]', { opacity: 0, scale: 0.3 }, { duration: 0.18, at: 0 }],
      [L, { rotate: -14 }, { duration: 0.32, ease: EASE_OUT, at: 0 }],
      [R, { rotate: 14 }, { duration: 0.32, ease: EASE_OUT, at: 0 }],
      // …then swing back in and hit.
      [L, { rotate: rest.left }, { duration: 0.3, ease: EASE_IN, at: hit - 0.3 }],
      [R, { rotate: rest.right }, { duration: 0.3, ease: EASE_IN, at: hit - 0.3 }],
      [L, { rotate: [rest.left, rest.left - 2, rest.left + 0.8, rest.left] }, { duration: 0.26, at: hit }],
      [R, { rotate: [rest.right, rest.right + 2, rest.right - 0.8, rest.right] }, { duration: 0.26, at: hit }],
      ['[data-wm="glow"]', { opacity: [0, 0.9, 0], scale: [0.4, 1.25, 1] }, { duration: 0.7, ease: 'easeOut', at: hit }],
      ['[data-wm="spark"]', { opacity: [0, 1], scale: [0.2, 1.3, 1] }, { duration: 0.45, ease: EASE_OUT, at: hit }],
    ]

    animate(sequence).then(() => {
      playing.current = false
    })
  }

  return (
    <span ref={scope} className="inline-block" onPointerEnter={play} onFocus={play}>
      <Wordmark className={className} tone={tone} />
    </span>
  )
}
