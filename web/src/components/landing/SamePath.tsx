import { motion, useReducedMotion, useScroll, useTransform, type MotionValue } from 'motion/react'
import { useRef, type ReactNode } from 'react'
import { G } from './garba'

// Not on the landing page right now; kept to be placed elsewhere on the site.
//
// "Same path": Kollide's story told with dots, as you scroll. You start
// alone; others with the same plan light up across the city; you and one of
// them collide; then everyone flows into a garba circle that starts turning.
// The screen holds still (sticky) while the story plays.

const clamp = (v: number) => Math.min(Math.max(v, 0), 1)
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)
const span = (p: number, a: number, b: number) => ease(clamp((p - a) / (b - a)))

// Beats, as fractions of the scroll through the section.
const ALONE = 0.2
const OTHERS = [0.2, 0.42] as const
const MEET = [0.42, 0.6] as const
const GATHER = [0.64, 0.84] as const
const SPIN = 0.84

// The garba ground, and the circle everyone ends up in.
const CX = 560
const CY = 300
const RX = 190
const RY = 120

// Where each dot starts, spread across the "city". Index 0 is you, 1 is the
// person you collide with.
const DOTS = [
  { x: 150, y: 470, color: G.rani, r: 21 },
  { x: 900, y: 120, color: G.marigold, r: 18 },
  { x: 120, y: 110, color: G.peacock, r: 14 },
  { x: 330, y: 60, color: G.haldi, r: 13 },
  { x: 950, y: 380, color: G.leaf, r: 14 },
  { x: 820, y: 540, color: G.orange, r: 13 },
  { x: 60, y: 300, color: G.maroon, r: 14 },
  { x: 620, y: 40, color: G.rani, r: 13 },
  { x: 460, y: 560, color: G.peacock, r: 14 },
  { x: 980, y: 250, color: G.haldi, r: 13 },
  { x: 250, y: 560, color: G.marigold, r: 13 },
]

// Seat i on the circle (you and your match sit side by side at the front).
function seat(i: number, turn: number) {
  const a = Math.PI / 2 + 0.28 - (i / DOTS.length) * Math.PI * 2 + turn
  return { x: CX + Math.cos(a) * RX, y: CY + Math.sin(a) * RY }
}

function position(i: number, p: number) {
  const turn = span(p, SPIN, 1) * 1.4
  const to = seat(i, turn)
  const from = DOTS[i]
  // You and your match head for your seats first and collide there; the
  // rest follow a little later.
  const t = i < 2 ? span(p, MEET[0], MEET[1]) : span(p, GATHER[0], GATHER[1])
  return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t }
}

function Dot({ i, progress }: { i: number; progress: MotionValue<number> }) {
  const d = DOTS[i]
  const cx = useTransform(progress, (p) => position(i, p).x)
  const cy = useTransform(progress, (p) => position(i, p).y)
  // Others light up during the second beat; you're there from the start.
  const opacity = useTransform(progress, (p) => (i === 0 ? 1 : span(p, OTHERS[0] + (i % 5) * 0.025, OTHERS[0] + 0.1 + (i % 5) * 0.025)))
  const glow = useTransform(progress, (p) => (i === 0 ? 0.35 + 0.25 * Math.sin(p * 60) ** 2 : 0.25))
  return (
    <motion.g style={{ opacity }}>
      <motion.circle cx={cx} cy={cy} r={d.r * 2.1} fill={d.color} style={{ opacity: glow }} />
      <motion.circle cx={cx} cy={cy} r={d.r} fill={d.color} stroke={G.cream} strokeWidth={i === 0 ? 4 : 3} />
    </motion.g>
  )
}

// The dashed trail each dot will travel, drawn ahead of it.
function Trail({ i, progress }: { i: number; progress: MotionValue<number> }) {
  const d = DOTS[i]
  const to = seat(i, 0)
  const [a, b] = i < 2 ? [MEET[0] - 0.06, MEET[0] + 0.06] : [OTHERS[0] + 0.05, OTHERS[1]]
  const draw = useTransform(progress, (p) => span(p, a, b))
  const opacity = useTransform(progress, (p) => (p < GATHER[0] ? 0.55 : 0.55 * (1 - span(p, GATHER[0], GATHER[1]))))
  // A gentle bend, so the trails read as routes across a city.
  const mx = (d.x + to.x) / 2 + (to.y - d.y) * 0.18
  const my = (d.y + to.y) / 2 - (to.x - d.x) * 0.18
  return (
    <motion.path
      d={`M ${d.x} ${d.y} Q ${mx} ${my} ${to.x} ${to.y}`}
      fill="none"
      stroke={d.color}
      strokeWidth="3.5"
      strokeLinecap="round"
      strokeDasharray="2 10"
      style={{ pathLength: draw, opacity }}
    />
  )
}

// The spark where you and your match collide.
function Spark({ progress }: { progress: MotionValue<number> }) {
  const a = seat(0, 0)
  const b = seat(1, 0)
  const x = (a.x + b.x) / 2
  const y = (a.y + b.y) / 2 - 8
  const opacity = useTransform(progress, (p) => clamp((p - (MEET[1] - 0.03)) / 0.03) * (1 - clamp((p - (MEET[1] + 0.06)) / 0.05)))
  const scale = useTransform(progress, (p) => 0.4 + 1.1 * clamp((p - (MEET[1] - 0.03)) / 0.09))
  return (
    <motion.g style={{ opacity, scale, originX: `${x}px`, originY: `${y}px` }}>
      {Array.from({ length: 12 }, (_, k) => {
        const ang = (k / 12) * Math.PI * 2
        const r1 = 16
        const r2 = k % 2 ? 34 : 46
        return (
          <line
            key={k}
            x1={x + Math.cos(ang) * r1}
            y1={y + Math.sin(ang) * r1}
            x2={x + Math.cos(ang) * r2}
            y2={y + Math.sin(ang) * r2}
            stroke={k % 2 ? G.rani : G.marigold}
            strokeWidth="4"
            strokeLinecap="round"
          />
        )
      })}
      <circle cx={x} cy={y} r="7" fill={G.haldi} />
    </motion.g>
  )
}

// A block of text that's on screen for one beat: fades and rises in, then
// out as the next beat arrives.
function Beat({ progress, from, to, children, last = false }: { progress: MotionValue<number>; from: number; to: number; children: ReactNode; last?: boolean }) {
  const opacity = useTransform(progress, (p) => {
    const inn = clamp((p - from) / 0.05)
    const out = last ? 1 : 1 - clamp((p - (to - 0.05)) / 0.05)
    return from === 0 ? out : Math.min(inn, out)
  })
  const y = useTransform(progress, (p) => (p < from + 0.05 && from > 0 ? 24 * (1 - clamp((p - from) / 0.05)) : 0))
  const pointerEvents = useTransform(opacity, (o) => (o > 0.5 ? 'auto' : 'none'))
  return (
    <motion.div className="absolute inset-x-0 top-0" style={{ opacity, y, pointerEvents }}>
      {children}
    </motion.div>
  )
}

const HEAD = 'font-display text-[2.3rem] font-extrabold leading-[1.02] tracking-[-0.04em] sm:text-5xl lg:text-6xl'

function Canvas({ progress }: { progress: MotionValue<number> }) {
  const ringOpacity = useTransform(progress, (p) => 0.15 + 0.35 * span(p, OTHERS[0], OTHERS[1]) + 0.5 * span(p, GATHER[0], GATHER[1]))
  const labelOpacity = useTransform(progress, (p) => span(p, OTHERS[0], OTHERS[0] + 0.1) * (1 - span(p, GATHER[1] - 0.05, GATHER[1])))
  const youLabel = useTransform(progress, (p) => position(0, p))
  const lx = useTransform(youLabel, (v) => v.x)
  const ly = useTransform(youLabel, (v) => v.y + 50)
  const youLabelOpacity = useTransform(progress, (p) => 1 - span(p, GATHER[0], GATHER[0] + 0.08))
  const glow = useTransform(progress, (p) => 0.6 * span(p, SPIN - 0.04, 1))

  return (
    <svg viewBox="0 0 1000 600" preserveAspectRatio="xMidYMid slice" className="h-full w-full overflow-visible" aria-hidden>
      <defs>
        <pattern id="same-path-grid" width="28" height="28" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1.6" fill={G.ink} opacity="0.13" />
        </pattern>
        <radialGradient id="same-path-glow">
          <stop offset="0" stopColor={G.haldi} stopOpacity="0.55" />
          <stop offset="1" stopColor={G.haldi} stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="1000" height="600" rx="36" fill="url(#same-path-grid)" />

      {/* Tonight's garba: a warm glow and the ground where the circle forms. */}
      <motion.ellipse cx={CX} cy={CY} rx={RX + 90} ry={RY + 70} fill="url(#same-path-glow)" style={{ opacity: glow }} />
      <motion.ellipse
        cx={CX}
        cy={CY}
        rx={RX}
        ry={RY}
        fill="none"
        stroke={G.maroon}
        strokeWidth="2"
        strokeDasharray="4 10"
        style={{ opacity: ringOpacity }}
      />
      <motion.text
        x={CX}
        y={CY + 6}
        textAnchor="middle"
        fontSize="22"
        fontWeight="700"
        fill={G.maroon}
        style={{ opacity: labelOpacity }}
      >
        Tonight's garba
      </motion.text>

      {DOTS.map((_, i) => (
        <Trail key={`t${i}`} i={i} progress={progress} />
      ))}
      {DOTS.map((_, i) => (
        <Dot key={`d${i}`} i={i} progress={progress} />
      ))}
      <Spark progress={progress} />
      <motion.text
        x={lx}
        y={ly}
        textAnchor="middle"
        fontSize="28"
        fontWeight="800"
        fill={G.rani}
        style={{ opacity: youLabelOpacity }}
      >
        You
      </motion.text>
    </svg>
  )
}

export default function SamePath({ onHow }: { onHow: () => void }) {
  const ref = useRef<HTMLElement>(null)
  const reduced = useReducedMotion()
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] })
  // Under reduced motion, skip the story and show where it ends.
  const progress = useTransform(scrollYProgress, (p) => (reduced ? 1 : p))

  const beats = [
    <p key="1" className={HEAD}>
      Got the night. Got the outfit. <span style={{ color: G.rani }}>Missing the people.</span>
    </p>,
    <p key="2" className={HEAD}>
      Across Bangalore, others have the same plan <span style={{ color: G.rani }}>and no one to go with.</span>
    </p>,
    <p key="3" className={HEAD}>
      Kollide puts you on the <span style={{ color: G.rani }}>same path.</span>
    </p>,
    <div key="4">
      <p className={HEAD}>
        Then the circle takes care of <span style={{ color: G.rani }}>the rest.</span>
      </p>
      <p className="mt-5 hidden max-w-md text-lg leading-relaxed opacity-80 lg:block">
        Plans are better when someone actually shows up. Pick your garba nights and meet verified people going to the same
        ground.
      </p>
      <button
        type="button"
        onClick={onHow}
        className="mt-5 rounded-full px-7 lg:mt-7 py-3.5 text-base font-bold shadow-lg shadow-[#2A0E1B]/15 transition hover:-translate-y-0.5 active:scale-[0.97]"
        style={{ backgroundColor: G.ink, color: G.cream }}
      >
        How it works
      </button>
    </div>,
  ]

  if (reduced) {
    return (
      <section ref={ref} id="same-path" aria-label="Why Kollide" className="px-5 py-24 sm:px-8 md:py-32 lg:px-12">
        <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-10">{beats}</div>
          <div className="aspect-[5/3] w-full">
            <Canvas progress={progress} />
          </div>
        </div>
      </section>
    )
  }

  const windows: [number, number][] = [
    [0, ALONE],
    [OTHERS[0], OTHERS[1]],
    [MEET[0], GATHER[0]],
    [GATHER[0], 1],
  ]

  return (
    <section ref={ref} id="same-path" aria-label="Why Kollide" className="relative h-[380svh]">
      <div className="sticky top-0 flex h-[100svh] items-center overflow-hidden px-5 sm:px-8 lg:px-12">
        <div className="mx-auto grid w-full max-w-7xl gap-6 lg:grid-cols-[0.8fr_1.2fr] lg:items-center lg:gap-10">
          <div className="relative h-[12.5rem] sm:h-[15rem] lg:h-[24rem]">
            {beats.map((b, k) => (
              <Beat key={k} progress={progress} from={windows[k][0]} to={windows[k][1]} last={k === beats.length - 1}>
                {b}
              </Beat>
            ))}
          </div>
          {/* Phones get a taller crop of the same scene. */}
          <div className="aspect-[4/3] w-full lg:aspect-[5/3]">
            <Canvas progress={progress} />
          </div>
        </div>
      </div>
    </section>
  )
}
