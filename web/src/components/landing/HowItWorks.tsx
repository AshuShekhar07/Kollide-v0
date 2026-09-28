import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
  type MotionValue,
} from 'motion/react'
import { useRef, useSyncExternalStore } from 'react'
import { FadeUp, RevealText } from './Reveal'

const STEPS = [
  {
    title: 'Get verified',
    body: 'Record a 10-second face video. A real person on our team checks it against your photos, usually within 24 hours. No bots, no catfish: everyone you meet has been through the same check.',
    points: ['10-second face video', 'Checked by hand', 'Usually within 24 hours'],
  },
  {
    title: 'Find your people',
    body: "Tell us which nights you're going and who you'd like to meet. Match with someone to go with, or join a group heading to the same garba ground. You can start your own group and invite people too.",
    points: ['One-on-one matches', 'Groups of up to 10', 'Same garba night'],
  },
  {
    title: 'Chat and show up',
    body: "Plan the night in chat: where to meet, what to wear, who's bringing the dandiya. Swap socials once you match, then dance till late.",
    points: ['Private chat', 'Swap socials', 'Block and report in one tap'],
  },
]

const WIDE_QUERY = '(min-width: 768px)'

function subscribeWide(onChange: () => void) {
  const mq = window.matchMedia(WIDE_QUERY)
  mq.addEventListener('change', onChange)
  return () => mq.removeEventListener('change', onChange)
}

function useWide() {
  return useSyncExternalStore(subscribeWide, () => window.matchMedia(WIDE_QUERY).matches, () => true)
}

const number = (i: number) => String(i + 1).padStart(2, '0')
const clamp = (v: number) => Math.min(Math.max(v, 0), 1)

// One step in the pinned view. Each owns a third of the scroll: it slides up
// and in, holds, then slides up and out as the next one arrives.
function PinnedStep({ index, progress }: { index: number; progress: MotionValue<number> }) {
  const n = STEPS.length
  const start = index / n
  const end = (index + 1) / n
  const first = index === 0
  const last = index === n - 1
  const fade = 0.07
  // Computed in JS (a function transform) rather than handed to the browser
  // as a native scroll animation, which mis-maps these multi-stop ranges.
  const phase = (p: number) => {
    // One step leaves before the next arrives, so they never overlap.
    const inT = first ? 1 : clamp((p - start) / fade)
    const outT = last ? 0 : clamp((p - (end - fade)) / fade)
    return { inT, outT }
  }
  const opacity = useTransform(progress, (p) => {
    const { inT, outT } = phase(p)
    return Math.min(inT, 1 - outT)
  })
  const y = useTransform(progress, (p) => {
    const { inT, outT } = phase(p)
    return outT > 0 ? -90 * outT : 90 * (1 - inT)
  })
  const step = STEPS[index]

  return (
    <motion.li className="absolute inset-0 flex flex-col justify-center" style={{ opacity, y }}>
      <span className="text-outline-orange block font-display text-[7rem] font-extrabold leading-none tracking-[-0.04em] lg:text-[9rem]">
        {number(index)}
      </span>
      <h3 className="mt-4 text-4xl font-extrabold tracking-[-0.025em] lg:text-5xl">{step.title}</h3>
      <p className="mt-5 max-w-lg text-lg leading-relaxed text-[#111]/70">{step.body}</p>
      <ul className="mt-7 flex flex-wrap gap-2">
        {step.points.map((p) => (
          <li key={p} className="rounded-full border border-[#111]/15 px-4 py-2 text-sm font-semibold">
            {p}
          </li>
        ))}
      </ul>
    </motion.li>
  )
}

// Wide screens: "How it works" stays pinned on the left while the three steps
// take turns on the right as you scroll. A bar tracks progress.
function Pinned() {
  const ref = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] })
  // "How it works" grows into place as the section pins. Function transforms
  // keep these in JS rather than native scroll animations.
  const headingScale = useTransform(scrollYProgress, (p) => 0.86 + 0.14 * clamp(p / 0.12))
  const headingOpacity = useTransform(scrollYProgress, (p) => 0.4 + 0.6 * clamp(p / 0.06))
  const bar = useTransform(scrollYProgress, (p) => clamp((p - 0.02) / 0.96))

  return (
    <section ref={ref} className="relative h-[330vh]" aria-label="How it works">
      <div className="sticky top-0 flex h-[100svh] items-center overflow-hidden">
        <div className="mx-auto grid w-full max-w-7xl grid-cols-[1fr_1.1fr] gap-16 px-8 lg:px-12">
          <motion.div className="origin-left" style={{ scale: headingScale, opacity: headingOpacity }}>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#E0661A]">Three steps to your first night out</p>
            <h2 className="mt-5 font-display text-[5.5rem] font-extrabold leading-[0.92] tracking-[-0.045em] lg:text-[7.5rem]">
              How it works
            </h2>
            <div className="mt-12 flex items-center gap-5">
              <div className="relative h-1 w-48 overflow-hidden rounded-full bg-[#111]/10">
                <motion.div className="absolute inset-0 origin-left rounded-full bg-[#E0661A]" style={{ scaleX: bar }} />
              </div>
              <ol className="flex gap-3 text-sm font-semibold text-[#111]/45">
                {STEPS.map((s, i) => (
                  <StepTick key={s.title} index={i} progress={scrollYProgress} />
                ))}
              </ol>
            </div>
          </motion.div>
          <ol className="relative h-[34rem]">
            {STEPS.map((s, i) => (
              <PinnedStep key={s.title} index={i} progress={scrollYProgress} />
            ))}
          </ol>
        </div>
      </div>
    </section>
  )
}

function StepTick({ index, progress }: { index: number; progress: MotionValue<number> }) {
  const n = STEPS.length
  const color = useTransform(progress, (p) => (p >= index / n - 0.02 ? '#111111' : 'rgba(17,17,17,0.35)'))
  return <motion.li style={{ color }}>{number(index)}</motion.li>
}

// Phones and reduced motion: a plain list where each step rises into view.
function Stacked() {
  return (
    <section className="mx-auto max-w-6xl px-5 py-20 sm:px-6" aria-label="How it works">
      <FadeUp>
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#E0661A]">Three steps to your first night out</p>
      </FadeUp>
      <RevealText
        text="How it works"
        className="mt-4 font-display text-6xl font-extrabold leading-[0.95] tracking-[-0.04em] sm:text-7xl"
      />
      <ol className="mt-14 space-y-16">
        {STEPS.map((step, i) => (
          <li key={step.title}>
            <FadeUp>
              <span className="text-outline-orange block font-display text-8xl font-extrabold leading-none tracking-[-0.04em]">
                {number(i)}
              </span>
              <h3 className="mt-3 text-3xl font-extrabold tracking-[-0.025em]">{step.title}</h3>
              <p className="mt-3 text-lg leading-relaxed text-[#111]/70">{step.body}</p>
              <ul className="mt-5 flex flex-wrap gap-2">
                {step.points.map((p) => (
                  <li key={p} className="rounded-full border border-[#111]/15 px-3.5 py-1.5 text-sm font-semibold">
                    {p}
                  </li>
                ))}
              </ul>
            </FadeUp>
          </li>
        ))}
      </ol>
    </section>
  )
}

export default function HowItWorks() {
  const wide = useWide()
  const reduced = useReducedMotion()
  return wide && !reduced ? <Pinned /> : <Stacked />
}
