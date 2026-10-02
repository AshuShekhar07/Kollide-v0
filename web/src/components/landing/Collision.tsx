import { motion, useReducedMotion, useScroll, useTransform, type MotionValue } from 'motion/react'
import { useRef } from 'react'
import { G } from './garba'

// Kollide's idea, paths that collide, told with photos as the section
// scrolls in: two people going solo slide in and collide into a "+1"; then
// the others going that night fly in and it becomes a crew, with a date
// night fanned alongside. Everything is driven by scroll, so the section is
// no taller than before.

const clamp = (v: number) => Math.min(Math.max(v, 0), 1)
const ease = (t: number) => 1 - (1 - t) ** 3
// 0 → 1 as p goes from a to b, eased.
const span = (p: number, a: number, b: number) => ease(clamp((p - a) / (b - a)))
const mix = (a: number, b: number, t: number) => a + (b - a) * t

// Beats, as fractions of the scroll progress.
const MEET = 0.36
const POP = 0.62
const SETTLE = [0.66, 0.84] as const

type Pose = { x: number; y?: number; rotate: number; scale: number; opacity: number }

type Card = {
  src: string
  alt: string
  position?: string
  tag: string
  bg: string
  fg: string
  // Resting place in the box (percent), and where it is at each moment.
  box: string
  pose: (p: number) => Pose
  z: number
  // Which edge the tag sits on (the outer edge for cards fanned out behind).
  tagSide?: 'left' | 'right'
}

const CARDS: Card[] = [
  {
    src: '/landing/collide-date-night.webp',
    alt: 'A girl playfully pulling a boy closer by his dupatta on the garba ground',
    position: '50% 45%',
    tag: 'Date night',
    bg: G.rani,
    fg: G.cream,
    box: 'left-0 top-[9%] h-[72%] w-[38%]',
    z: 10,
    tagSide: 'left',
    // Fans out to the left from behind the crew once it lands.
    pose: (p) => {
      const t = span(p, SETTLE[0], SETTLE[1])
      return { x: mix(60, 0, t), rotate: mix(0, -7, t), scale: mix(0.9, 1, t), opacity: t }
    },
  },
  {
    src: '/landing/collide-plus-one.webp',
    alt: 'A couple in garba outfits walking hand in hand at night',
    position: '50% 40%',
    tag: 'Your +1',
    bg: G.peacock,
    fg: G.cream,
    box: 'left-[62%] top-[9%] h-[72%] w-[38%]',
    z: 20,
    // Appears in the middle where the two solo cards collide, then steps
    // back to the right when the crew arrives.
    pose: (p) => {
      const appear = span(p, MEET - 0.01, MEET + 0.07)
      const back = span(p, SETTLE[0], SETTLE[1])
      return { x: mix(-70, 0, back), rotate: mix(0, 7, back), scale: mix(mix(0.8, 1.12, appear), 1, back), opacity: appear }
    },
  },
  {
    src: '/landing/collide-crew.webp',
    alt: 'A big group of friends in garba outfits posing together on the ground at night',
    position: '50% 55%',
    tag: 'Your crew',
    bg: G.haldi,
    fg: G.ink,
    box: 'left-[25%] top-[3%] h-[86%] w-[50%]',
    z: 30,
    // Pops out of the "+1" when the others arrive.
    pose: (p) => {
      const t = span(p, POP - 0.02, POP + 0.08)
      return { x: 0, rotate: mix(-4, 0, t), scale: mix(0.7, 1, t), opacity: t }
    },
  },
  {
    src: '/landing/collide-solo-boy.webp',
    alt: 'A boy in a maroon kurta adjusting his dupatta at a garba night',
    position: '50% 35%',
    tag: 'Going solo',
    bg: G.maroon,
    fg: G.cream,
    box: 'left-[11%] top-[18%] h-[64%] w-[38%]',
    z: 40,
    // From the left edge to the middle, then gone in the collision.
    pose: (p) => {
      const t = span(p, 0, MEET)
      const out = span(p, MEET, MEET + 0.06)
      return { x: mix(-75, 8, t), rotate: mix(-14, -3, t), scale: mix(1, 0.85, out), opacity: Math.min(span(p, 0, 0.08), 1 - out) }
    },
  },
  {
    src: '/landing/collide-solo-girl.webp',
    alt: 'A girl twirling in a navy chaniya choli outside at night',
    position: '50% 50%',
    tag: 'Going solo',
    bg: G.marigold,
    fg: G.ink,
    box: 'left-[51%] top-[18%] h-[64%] w-[38%]',
    z: 40,
    pose: (p) => {
      const t = span(p, 0, MEET)
      const out = span(p, MEET, MEET + 0.06)
      return { x: mix(75, -8, t), rotate: mix(14, 3, t), scale: mix(1, 0.85, out), opacity: Math.min(span(p, 0, 0.08), 1 - out) }
    },
  },
]

function PhotoCard({ card, progress }: { card: Card; progress: MotionValue<number> }) {
  const x = useTransform(progress, (p) => `${card.pose(p).x}%`)
  const rotate = useTransform(progress, (p) => card.pose(p).rotate)
  const scale = useTransform(progress, (p) => card.pose(p).scale)
  const opacity = useTransform(progress, (p) => card.pose(p).opacity)
  return (
    <motion.figure
      className={`absolute overflow-hidden rounded-[24px] bg-[#f1ece6] shadow-2xl shadow-[#2A0E1B]/25 ring-4 ring-[#FFF4E4] ${card.box}`}
      style={{ x, rotate, scale, opacity, zIndex: card.z }}
    >
      <img
        src={card.src}
        alt={card.alt}
        loading="lazy"
        decoding="async"
        draggable={false}
        className="absolute inset-0 h-full w-full select-none object-cover"
        style={{ objectPosition: card.position }}
      />
      <figcaption
        className={`absolute top-3 ${card.tagSide === 'left' ? 'left-2 sm:left-3' : 'right-2 sm:right-3'} rounded-full px-1.5 py-3 font-display text-xs font-extrabold tracking-[-0.01em] shadow-md [writing-mode:vertical-rl] sm:top-4 sm:px-2.5 sm:py-4 sm:text-base`}
        style={{ backgroundColor: card.bg, color: card.fg }}
      >
        {card.tag}
      </figcaption>
    </motion.figure>
  )
}

// A burst where things collide: rays and a flash, shown around moment `at`.
function Spark({ progress, at, x, y }: { progress: MotionValue<number>; at: number; x: string; y: string }) {
  const opacity = useTransform(progress, (p) => clamp((p - (at - 0.025)) / 0.025) * (1 - clamp((p - (at + 0.03)) / 0.05)))
  const scale = useTransform(progress, (p) => 0.4 + 1.2 * clamp((p - (at - 0.025)) / 0.09))
  return (
    <motion.div className="pointer-events-none absolute z-50 h-28 w-28 -translate-x-1/2 -translate-y-1/2" style={{ left: x, top: y, opacity, scale }} aria-hidden>
      <svg viewBox="0 0 100 100" className="h-full w-full overflow-visible">
        <circle cx="50" cy="50" r="14" fill="#fff" opacity="0.9" />
        {Array.from({ length: 12 }, (_, i) => {
          const a = (i / 12) * Math.PI * 2
          const r2 = i % 2 ? 38 : 50
          return (
            <line
              key={i}
              x1={50 + Math.cos(a) * 18}
              y1={50 + Math.sin(a) * 18}
              x2={50 + Math.cos(a) * r2}
              y2={50 + Math.sin(a) * r2}
              stroke={i % 2 ? G.rani : G.haldi}
              strokeWidth="5"
              strokeLinecap="round"
            />
          )
        })}
      </svg>
    </motion.div>
  )
}

// The others going that night, as bubbles flying in to join the "+1".
const BUBBLES = [
  { from: [-38, -42], color: G.rani },
  { from: [44, -38], color: G.peacock },
  { from: [40, 46], color: G.haldi },
]

function Bubble({ progress, from, color, i }: { progress: MotionValue<number>; from: number[]; color: string; i: number }) {
  const start = 0.44 + i * 0.03
  const t = (p: number) => span(p, start, POP)
  const x = useTransform(progress, (p) => `${mix(from[0], 0, t(p))}vmin`)
  const y = useTransform(progress, (p) => `${mix(from[1], 0, t(p))}vmin`)
  const opacity = useTransform(progress, (p) => (p < start ? 0 : p > POP + 0.01 ? 0 : 1))
  const scale = useTransform(progress, (p) => mix(1, 0.6, t(p)))
  return (
    <motion.span
      className="pointer-events-none absolute left-1/2 top-[45%] z-50 -ml-6 -mt-6 flex h-12 w-12 items-center justify-center rounded-full shadow-lg ring-4 ring-[#FFF4E4]"
      style={{ x, y, opacity, scale, backgroundColor: color }}
      aria-hidden
    >
      <span className="h-3 w-3 rounded-full bg-[#FFF4E4]" />
    </motion.span>
  )
}

export default function Collision() {
  const ref = useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion()
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 0.5', 'start -0.05'] })
  // Under reduced motion, show where it ends: the crew with both couples.
  const progress = useTransform(scrollYProgress, (p) => (reduced ? 1 : p))

  return (
    <div ref={ref} className="relative h-[26rem] w-full sm:h-[32rem] lg:h-[36rem]">
      {CARDS.map((card) => (
        <PhotoCard key={card.src} card={card} progress={progress} />
      ))}
      {BUBBLES.map((b, i) => (
        <Bubble key={i} i={i} progress={progress} from={b.from} color={b.color} />
      ))}
      <Spark progress={progress} at={MEET} x="50%" y="48%" />
      <Spark progress={progress} at={POP} x="50%" y="45%" />
    </div>
  )
}
