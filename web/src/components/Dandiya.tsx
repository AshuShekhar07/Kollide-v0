import { motion, useAnimate, useReducedMotion } from 'motion/react'
import { useEffect } from 'react'

// Two dandiya sticks leaning in until their tips meet, with little ghungroo
// tassels at the grips and a spark where they clack: Kollide's "I'd like to
// dance with you". Drawn like a lucide icon so it can stand in for one (sized
// by className, coloured by currentColor).
function Sticks({ strokeWidth }: { strokeWidth: number }) {
  return (
    <>
      <g data-d="l">
        <path d="M5.5 20.5 13.6 7.2" />
        {/* A band near the grip */}
        <path d="M6.2 17.6 8.3 18.9" strokeWidth={strokeWidth * 0.75} />
        <circle cx="4.9" cy="22" r="1" fill="currentColor" stroke="none" />
      </g>
      <g data-d="r">
        <path d="M18.5 20.5 10.4 7.2" />
        <path d="M17.8 17.6 15.7 18.9" strokeWidth={strokeWidth * 0.75} />
        <circle cx="19.1" cy="22" r="1" fill="currentColor" stroke="none" />
      </g>
      <g data-d="spark">
        <path d="M12 1.6v2.6" />
        <path d="M7.5 3.4 9 5" />
        <path d="M16.5 3.4 15 5" />
      </g>
    </>
  )
}

export function DandiyaIcon({ className = 'h-6 w-6', strokeWidth = 2 }: { className?: string; strokeWidth?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <Sticks strokeWidth={strokeWidth} />
    </svg>
  )
}

/**
 * The same icon, which clacks whenever `play` changes: the sticks swing
 * apart, snap back together and the spark pops.
 */
export function AnimatedDandiya({
  className = 'h-6 w-6',
  strokeWidth = 2,
  play = 0,
}: {
  className?: string
  strokeWidth?: number
  play?: number
}) {
  const [scope, animate] = useAnimate<SVGSVGElement>()
  const reduced = useReducedMotion()

  useEffect(() => {
    if (!play || reduced) return
    const controls = animate([
      ['[data-d="l"]', { originX: 0, originY: 1 }, { duration: 0, at: 0 }],
      ['[data-d="r"]', { originX: 1, originY: 1 }, { duration: 0, at: 0 }],
      ['[data-d="spark"]', { originX: 0.5, originY: 1 }, { duration: 0, at: 0 }],
      ['[data-d="l"]', { rotate: [0, -18, 3, 0] }, { duration: 0.55, ease: 'easeInOut', at: 0 }],
      ['[data-d="r"]', { rotate: [0, 18, -3, 0] }, { duration: 0.55, ease: 'easeInOut', at: 0 }],
      ['[data-d="spark"]', { opacity: [1, 0, 1, 1], scale: [1, 0.3, 1.45, 1] }, { duration: 0.6, at: 0 }],
    ])
    return () => controls.stop()
  }, [play, reduced, animate])

  return (
    <svg
      ref={scope}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`overflow-visible ${className}`}
      aria-hidden
    >
      <Sticks strokeWidth={strokeWidth} />
    </svg>
  )
}

// Striped like a real dandiya: coloured bands at the grip and the tip, with a
// row of little mirror dots and a shine down one edge.
function stickStyle(main: string, band: string) {
  return {
    backgroundImage: [
      'linear-gradient(to right, rgb(255 255 255 / 0.35), transparent 45%, rgb(0 0 0 / 0.18))',
      'radial-gradient(circle, rgb(255 255 255 / 0.85) 0 1.2px, transparent 1.8px)',
      `linear-gradient(to top, ${band} 0 10%, ${main} 10% 13%, ${band} 13% 22%, ${main} 22% 84%, ${band} 84% 88%, ${main} 88% 92%, ${band} 92%)`,
    ].join(', '),
    backgroundSize: '100% 100%, 14px 16px, 100% 100%',
    backgroundPosition: '0 0, 0 40%, 0 0',
    backgroundRepeat: 'no-repeat, repeat-y, no-repeat',
  }
}

const SPARKS = Array.from({ length: 12 }, (_, i) => (i / 12) * 360)
// When the sticks meet: a small tap, then the real clack.
const TAP = 0.72
const CLACK = 1.35

/**
 * Two big sticks swinging in from either side: a tap, a pull back, then a
 * clack that locks them together with a flash, a ring of sparks and a
 * shockwave, after which the meeting point keeps glowing. Place it behind
 * the two match photos, so each person seems to be holding one.
 *
 * The box is 17rem × 15rem; the sticks start behind points 4.5rem in from
 * each side, 7.5rem down, and meet 1rem from the top.
 */
export function DandiyaClash({ className = '' }: { className?: string }) {
  // Grip at (72, 120), tip at (136, 16): 122px long, leaning 31.6° inwards.
  // Sticks are 14px wide, so each sits 7px left of its grip point.
  const lean = 31.6
  const sticks = [
    { side: -1, left: 65, style: stickStyle('var(--color-marigold-400)', 'var(--color-rani)') },
    { side: 1, left: 193, style: stickStyle('var(--color-rani)', 'var(--color-marigold-400)') },
  ]
  return (
    <div className={`pointer-events-none absolute left-1/2 top-0 h-60 w-[17rem] -translate-x-1/2 ${className}`} aria-hidden>
      {/* The glow that stays where the sticks meet. */}
      <motion.span
        className="absolute left-1/2 top-4 -ml-10 -mt-10 h-20 w-20 rounded-full bg-marigold-300/60 blur-xl"
        initial={{ opacity: 0, scale: 0.4 }}
        animate={{ opacity: [0, 1, 0.55, 0.8, 0.55], scale: [0.4, 1.6, 1, 1.15, 1] }}
        transition={{ duration: 3, delay: CLACK, times: [0, 0.12, 0.4, 0.7, 1], repeat: Infinity, repeatDelay: 0.2 }}
      />
      {sticks.map((s) => (
        <motion.span
          key={s.side}
          className="absolute top-[-2px] h-[122px] w-3.5 origin-bottom rounded-full shadow-lg shadow-black/30"
          style={{ left: s.left, ...s.style }}
          initial={{ rotate: s.side * 80, opacity: 0 }}
          animate={{
            rotate: [s.side * 80, -s.side * lean, -s.side * (lean - 18), -s.side * lean, -s.side * (lean + 2.5), -s.side * lean],
            opacity: 1,
          }}
          transition={{ duration: 1.25, delay: 0.3, times: [0, 0.34, 0.6, 0.84, 0.92, 1], ease: 'easeInOut' }}
        />
      ))}
      {/* A small spark on the tap… */}
      <span className="absolute left-1/2 top-4">
        {SPARKS.filter((_, i) => i % 2 === 0).map((deg) => (
          <span key={deg} className="absolute left-0 top-0" style={{ transform: `rotate(${deg}deg)` }}>
            <motion.span
              className="absolute -top-0.5 left-0 block h-1 w-2.5 origin-left rounded-full bg-marigold-300"
              initial={{ x: 0, scaleX: 0, opacity: 0 }}
              animate={{ x: [0, 8, 14], scaleX: [0, 1, 0.2], opacity: [0, 1, 0] }}
              transition={{ duration: 0.35, delay: TAP, ease: 'easeOut' }}
            />
          </span>
        ))}
      </span>
      {/* …and the big one on the clack: a white flash, a shockwave and long rays. */}
      <motion.span
        className="absolute left-1/2 top-4 -ml-6 -mt-6 h-12 w-12 rounded-full bg-white"
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: [0, 0.95, 0], scale: [0, 1.4, 2.2] }}
        transition={{ duration: 0.45, delay: CLACK, ease: 'easeOut' }}
      />
      <motion.span
        className="absolute left-1/2 top-4 -ml-8 -mt-8 h-16 w-16 rounded-full border-[3px] border-marigold-300"
        initial={{ opacity: 0, scale: 0.2 }}
        animate={{ opacity: [0, 1, 0], scale: [0.2, 2.4, 3.4] }}
        transition={{ duration: 0.8, delay: CLACK, ease: 'easeOut' }}
      />
      <span className="absolute left-1/2 top-4">
        {SPARKS.map((deg, i) => (
          <span key={deg} className="absolute left-0 top-0" style={{ transform: `rotate(${deg}deg)` }}>
            <motion.span
              className={`absolute -top-[3px] left-0 block h-1.5 origin-left rounded-full ${i % 2 ? 'w-4 bg-rani' : 'w-6 bg-marigold-300'}`}
              initial={{ x: 0, scaleX: 0, opacity: 0 }}
              animate={{ x: [4, 22, 42], scaleX: [0, 1, 0.15], opacity: [0, 1, 0] }}
              transition={{ duration: 0.6, delay: CLACK, ease: 'easeOut' }}
            />
          </span>
        ))}
      </span>
    </div>
  )
}
