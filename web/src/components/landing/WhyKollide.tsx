import { motion, useReducedMotion, useScroll, useTransform, type MotionValue } from 'motion/react'
import { useRef } from 'react'
import { FadeUp, RevealText } from './Reveal'

const RED = '#FF2A26'
const TEXT = '#FFF6EC'
const INK = '#2A0E1B'

const clamp = (v: number) => Math.min(Math.max(v, 0), 1)

const REASONS = [
  {
    line: 'Stop waiting for your friends to be free.',
    body: "Pick the nights you're going. We'll find the people who also said “I'm down.”",
  },
  {
    line: "You don't need more friends. You need someone to go with.",
    body: 'Go as a pair, or join a group of up to 10 heading to the same garba.',
  },
  {
    line: 'Real people. Real plans. Real meetups.',
    body: "Every profile is checked by a person on our team, so you know who you're meeting before you meet them.",
  },
  {
    line: 'From “I want to go” to “Who’s coming?”',
    body: 'Match, plan the night in chat, swap socials, and actually show up.',
  },
]

// One word that lights up as the line's scroll progress passes it.
function Word({ children, progress, index, count }: { children: string; progress: MotionValue<number>; index: number; count: number }) {
  const reduced = useReducedMotion()
  const opacity = useTransform(progress, (p) => (reduced ? 1 : 0.2 + 0.8 * clamp(p * count - index)))
  const y = useTransform(progress, (p) => (reduced ? 0 : 6 * (1 - clamp(p * count - index))))
  return (
    <motion.span className="inline-block" style={{ opacity, y }}>
      {children}
    </motion.span>
  )
}

/**
 * A line whose words light up one by one as it scrolls up through the
 * screen, so reading keeps pace with scrolling.
 */
function ScrollWords({ text, className }: { text: string; className: string }) {
  const ref = useRef<HTMLParagraphElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 0.9', 'end 0.55'] })
  const words = text.split(' ')
  return (
    <p ref={ref} className={className}>
      <span className="sr-only">{text}</span>
      <span aria-hidden>
        {words.map((w, i) => (
          <span key={i}>
            <Word progress={scrollYProgress} index={i} count={words.length}>
              {w}
            </Word>{' '}
          </span>
        ))}
      </span>
    </p>
  )
}

/**
 * Two paths drawn in from either side as you scroll, meeting in the middle
 * with a spark: where paths collide.
 */
function PathsCollide() {
  const ref = useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion()
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 0.95', 'center 0.5'] })
  const draw = useTransform(scrollYProgress, (p) => (reduced ? 1 : clamp(p / 0.9)))
  const burst = useTransform(scrollYProgress, (p) => (reduced ? 1 : clamp((p - 0.88) / 0.12)))
  const burstScale = useTransform(burst, (b) => 0.4 + 0.6 * b)

  return (
    <div ref={ref} className="relative mx-auto h-40 w-full sm:h-56 lg:h-64" aria-hidden>
      <svg viewBox="0 0 1000 200" className="h-full w-full overflow-visible" fill="none">
        <motion.path
          d="M-40 170 C 180 170, 260 40, 420 70 S 470 110, 500 100"
          stroke={TEXT}
          strokeWidth="6"
          strokeLinecap="round"
          style={{ pathLength: draw }}
        />
        <motion.path
          d="M1040 30 C 820 30, 740 160, 580 130 S 530 90, 500 100"
          stroke={INK}
          strokeWidth="6"
          strokeLinecap="round"
          style={{ pathLength: draw }}
        />
        <motion.g style={{ opacity: burst, scale: burstScale, originX: '500px', originY: '100px' }}>
          <circle cx="500" cy="100" r="34" fill={TEXT} opacity="0.25" />
          <circle cx="500" cy="100" r="11" fill={TEXT} />
          {Array.from({ length: 10 }, (_, i) => {
            const a = (i / 10) * Math.PI * 2
            const r1 = 22
            const r2 = i % 2 ? 44 : 58
            return (
              <line
                key={i}
                x1={500 + Math.cos(a) * r1}
                y1={100 + Math.sin(a) * r1}
                x2={500 + Math.cos(a) * r2}
                y2={100 + Math.sin(a) * r2}
                stroke={i % 2 ? INK : TEXT}
                strokeWidth="5"
                strokeLinecap="round"
              />
            )
          })}
        </motion.g>
      </svg>
    </div>
  )
}

/**
 * Why Kollide: a red block that opens out from a rounded card to full width
 * as it scrolls in, with the reasons lighting up word by word, centred.
 */
export default function WhyKollide() {
  const ref = useRef<HTMLElement>(null)
  const reduced = useReducedMotion()
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'start 0.2'] })
  const clipPath = useTransform(scrollYProgress, (p) => {
    const t = reduced ? 1 : clamp(p)
    return `inset(0 ${(1 - t) * 5}% round ${48 - 24 * t}px)`
  })

  return (
    <motion.section
      ref={ref}
      id="why-kollide"
      aria-label="Why Kollide?"
      className="bandhani-soft relative px-5 py-24 text-center sm:px-8 md:py-36"
      style={{ backgroundColor: RED, color: TEXT, clipPath }}
    >
      <div className="mx-auto max-w-[88rem]">
        <RevealText
          text="Why Kollide?"
          className="font-display text-6xl font-extrabold leading-[0.95] tracking-[-0.045em] sm:text-8xl lg:text-[9rem]"
        />

        <ScrollWords
          text="Plans are easy. Finding people is hard. We handle the second part."
          className="mx-auto mt-10 font-display text-3xl font-bold leading-[1.1] tracking-[-0.03em] sm:text-5xl lg:text-6xl"
        />

        <div className="mt-24 space-y-20 md:mt-32 md:space-y-28">
          {REASONS.map((r) => (
            <div key={r.line}>
              <ScrollWords
                text={r.line}
                className="mx-auto font-display text-4xl font-extrabold leading-[1.02] tracking-[-0.04em] sm:text-6xl lg:text-7xl xl:text-8xl"
              />
              <FadeUp delay={0.1}>
                <p className="mx-auto mt-6 max-w-4xl text-lg font-bold italic leading-relaxed opacity-95 sm:text-2xl">{r.body}</p>
              </FadeUp>
            </div>
          ))}
        </div>

        <div className="mt-24 md:mt-32">
          <PathsCollide />
          <ScrollWords
            text="Your friends couldn’t make it. Your plans still can."
            className="mx-auto mt-10 font-display text-4xl font-extrabold leading-[1.02] tracking-[-0.04em] sm:text-6xl lg:text-7xl xl:text-8xl"
          />
          <FadeUp delay={0.1}>
            <p className="mt-8 text-xl font-bold italic sm:text-3xl">
              Kollide. Where paths collide.
            </p>
          </FadeUp>
        </div>
      </div>
    </motion.section>
  )
}
