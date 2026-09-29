import { motion } from 'motion/react'

// Two dandiya sticks leaning in until their tips meet, with a little spark:
// Kollide's "I'd like to dance with you". Drawn like a lucide icon so it can
// stand in for one (sized by className, coloured by currentColor).
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
      {/* The sticks, just crossing at the tips */}
      <path d="M5 21.5 13.8 7" />
      <path d="M19 21.5 10.2 7" />
      {/* The clack */}
      <path d="M12 1.8v2.4" />
      <path d="M7.4 3.6 8.8 5.2" />
      <path d="M16.6 3.6 15.2 5.2" />
    </svg>
  )
}

// Striped like a real dandiya: coloured bands at the grip and the tip.
function stickStyle(main: string, band: string) {
  return {
    background: `linear-gradient(to top, ${band} 0 10%, ${main} 10% 13%, ${band} 13% 22%, ${main} 22% 84%, ${band} 84% 88%, ${main} 88% 92%, ${band} 92%)`,
  }
}

const SPARKS = Array.from({ length: 8 }, (_, i) => (i / 8) * 360)

/**
 * Two big sticks swinging in from either side and clacking together twice at
 * the top middle of `className`'s box. Place it behind the two match photos,
 * so each person seems to be holding one.
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
      {sticks.map((s) => (
        <motion.span
          key={s.side}
          className="absolute top-[-2px] h-[122px] w-3.5 origin-bottom rounded-full shadow-lg shadow-black/30"
          style={{ left: s.left, ...s.style }}
          initial={{ rotate: s.side * 75, opacity: 0 }}
          animate={{ rotate: [s.side * 75, -s.side * lean, -s.side * (lean - 16), -s.side * lean], opacity: 1 }}
          transition={{ duration: 1.1, delay: 0.35, times: [0, 0.35, 0.62, 1], ease: 'easeInOut' }}
        />
      ))}
      {/* A spark on each clack. */}
      {[0.73, 1.45].map((delay) => (
        <span key={delay} className="absolute left-1/2 top-4">
          {SPARKS.map((deg) => (
            <span key={deg} className="absolute left-0 top-0" style={{ transform: `rotate(${deg}deg)` }}>
              <motion.span
                className="absolute -top-0.5 left-0 block h-1 w-3 origin-left rounded-full bg-marigold-300"
                initial={{ x: 0, scaleX: 0, opacity: 0 }}
                animate={{ x: [0, 12, 22], scaleX: [0, 1, 0.2], opacity: [0, 1, 0] }}
                transition={{ duration: 0.45, delay, ease: 'easeOut' }}
              />
            </span>
          ))}
        </span>
      ))}
    </div>
  )
}
