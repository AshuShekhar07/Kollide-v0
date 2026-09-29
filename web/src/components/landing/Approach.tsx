import { motion, useReducedMotion, useScroll, useTransform, type MotionValue } from 'motion/react'
import { useRef, type ReactNode } from 'react'
import { G } from './garba'
import { EASE_OUT } from './motion'
import { FadeUp } from './Reveal'

const clamp = (v: number) => Math.min(Math.max(v, 0), 1)

// The photo stack, front to back. Each card carries a tag down its edge.
const CARDS = [
  {
    src: '/landing/together-dandiya.webp',
    alt: 'Friends crossing dandiya sticks into a star',
    tag: 'Garba nights',
    bg: G.haldi,
    fg: G.ink,
    box: 'left-0 top-0 h-full w-[60%] z-30',
  },
  {
    src: '/landing/step-people.webp',
    alt: 'A group of friends laughing under a canopy of coloured fabric',
    position: '40% 60%',
    tag: 'New crew',
    bg: G.rani,
    fg: G.cream,
    box: 'left-[44%] top-[7%] h-[86%] w-[34%] z-20',
  },
  {
    src: '/landing/partner-bangle.webp',
    alt: "A girl's bangle caught on a boy's kurta",
    tag: 'Your +1',
    bg: G.peacock,
    fg: G.cream,
    box: 'left-[70%] top-[14%] h-[72%] w-[30%] z-10',
  },
]

const HEADLINE = ['Plans', 'are', 'better', 'when', 'someone', 'actually']
const CIRCLED = 'shows up.'

// One word sliding up from behind a mask, in turn, when the headline around
// it comes into view (the headline carries the trigger: a word hidden behind
// its own mask never counts as visible).
function MaskWord({ children, index }: { children: ReactNode; index: number }) {
  return (
    <span className="-mb-[0.14em] inline-block overflow-hidden pb-[0.14em] align-top">
      <motion.span
        className="inline-block"
        variants={{ hidden: { y: '110%' }, shown: { y: '0%', transition: { duration: 0.8, delay: index * 0.05, ease: EASE_OUT } } }}
      >
        {children}
      </motion.span>
    </span>
  )
}

// A loose pen circle drawn around a phrase once the headline is in.
function Circled({ children, delay }: { children: ReactNode; delay: number }) {
  return (
    <span className="relative inline-block whitespace-nowrap">
      {children}
      <svg
        viewBox="0 0 300 100"
        preserveAspectRatio="none"
        className="pointer-events-none absolute overflow-visible"
        style={{ left: '-7%', top: '-12%', width: '114%', height: '124%' }}
        aria-hidden
      >
        <motion.path
          d="M 70 10 C 160 -4, 284 6, 294 44 C 304 84, 182 100, 108 95 C 38 90, 2 70, 9 43 C 16 15, 96 3, 186 9"
          fill="none"
          stroke={G.rani}
          strokeWidth="3.5"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          initial={{ pathLength: 0 }}
          whileInView={{ pathLength: 1 }}
          viewport={{ once: true, amount: 0.8 }}
          transition={{ duration: 1.1, delay, ease: [0.65, 0, 0.35, 1] }}
        />
      </svg>
    </span>
  )
}

// A hand-drawn arrow curving down towards the button.
function PenArrow({ className }: { className: string }) {
  const draw = {
    initial: { pathLength: 0 },
    whileInView: { pathLength: 1 },
    viewport: { once: true, amount: 0.6 },
  }
  return (
    <svg viewBox="0 0 120 130" className={className} fill="none" aria-hidden>
      <motion.path
        d="M 12 4 C 6 40, 22 78, 58 100 C 74 110, 92 114, 108 114"
        stroke={G.maroon}
        strokeWidth="2.5"
        strokeLinecap="round"
        {...draw}
        transition={{ duration: 0.9, delay: 0.3, ease: 'easeInOut' }}
      />
      <motion.path
        d="M 94 102 L 110 114 L 92 124"
        stroke={G.maroon}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        {...draw}
        transition={{ duration: 0.3, delay: 1.15, ease: 'easeOut' }}
      />
    </svg>
  )
}

// The back cards start tucked behind the front one and fan out to the right
// as the section scrolls in.
function StackCard({ card, index, progress }: { card: (typeof CARDS)[number]; index: number; progress: MotionValue<number> }) {
  const reduced = useReducedMotion()
  const x = useTransform(progress, (p) => (reduced || index === 0 ? '0%' : `${-(1 - clamp(p)) * 60 * index}%`))
  const rotate = useTransform(progress, (p) => (reduced ? 0 : (1 - clamp(p)) * (index === 0 ? -3 : 4 * index)))
  return (
    <motion.figure
      className={`absolute overflow-hidden rounded-[26px] bg-[#f1ece6] shadow-2xl shadow-[#2A0E1B]/20 ${card.box}`}
      style={{ x, rotate }}
    >
      <img
        src={card.src}
        alt={card.alt}
        loading="lazy"
        decoding="async"
        className="absolute inset-0 h-full w-full object-cover"
        style={{ objectPosition: card.position }}
      />
      <motion.figcaption
        className="absolute right-2.5 top-3 rounded-full px-2 py-4 font-display text-sm font-extrabold tracking-[-0.01em] [writing-mode:vertical-rl] sm:right-3 sm:top-4 sm:px-2.5 sm:py-5 sm:text-lg"
        style={{ backgroundColor: card.bg, color: card.fg }}
        initial={{ y: -24, opacity: 0 }}
        whileInView={{ y: 0, opacity: 1 }}
        viewport={{ once: true, amount: 0.5 }}
        transition={{ duration: 0.6, delay: 0.4 + index * 0.15, ease: EASE_OUT }}
      >
        {card.tag}
      </motion.figcaption>
    </motion.figure>
  )
}

const MORE = ['More people to dance with.', 'More nights worth leaving home for.', 'More plans that actually happen.']

/**
 * Our approach: what Kollide is for, straight after the hero. A headline
 * with a phrase circled in pen, a short explanation with an arrow to How
 * it works, a fanned stack of photos, then a big "More…" statement signed
 * off in italics.
 */
export default function Approach({ onHow }: { onHow: () => void }) {
  const stackRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: stackRef, offset: ['start end', 'center 0.6'] })

  return (
    <section id="approach" aria-label="Our approach" className="px-5 pb-12 pt-24 sm:px-8 md:pb-20 md:pt-32 lg:px-12">
      <div className="mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-[1.05fr_1fr] lg:gap-16">
        <div>
          <FadeUp>
            <p className="text-lg font-semibold sm:text-xl" style={{ color: G.rani }}>
              Our approach
            </p>
          </FadeUp>
          <motion.h2
            initial="hidden"
            whileInView="shown"
            viewport={{ once: true, amount: 0.5 }}
            className="mt-4 font-display text-[2.9rem] font-extrabold leading-[1.02] tracking-[-0.04em] sm:text-6xl lg:text-[4.6rem]"
            style={{ color: G.maroon }}
          >
            <span className="sr-only">Plans are better when someone actually shows up.</span>
            <span aria-hidden>
              {HEADLINE.map((w, i) => (
                <span key={w}>
                  <MaskWord index={i}>{w}</MaskWord>{' '}
                </span>
              ))}
              <Circled delay={0.75}>
                <MaskWord index={HEADLINE.length}>{CIRCLED}</MaskWord>
              </Circled>
            </span>
          </motion.h2>

          <div className="mt-8 flex items-start gap-3 sm:mt-10 sm:gap-5">
            <PenArrow className="mt-1 hidden h-28 w-24 shrink-0 sm:block" />
            <FadeUp delay={0.2} className="max-w-md">
              <p className="text-lg leading-relaxed opacity-80">
                Kollide is built for the plan, not the scroll. Pick your garba nights, meet verified people going to the
                same ground, and show up together.
              </p>
              <button
                type="button"
                onClick={onHow}
                className="mt-7 rounded-full px-7 py-3.5 text-base font-bold shadow-lg shadow-[#2A0E1B]/15 transition hover:-translate-y-0.5 active:scale-[0.97]"
                style={{ backgroundColor: G.ink, color: G.cream }}
              >
                How it works
              </button>
            </FadeUp>
          </div>
        </div>

        <div ref={stackRef} className="relative h-[26rem] w-full sm:h-[32rem] lg:h-[36rem]">
          {CARDS.map((card, i) => (
            <StackCard key={card.src} card={card} index={i} progress={scrollYProgress} />
          ))}
        </div>
      </div>

      <div className="mx-auto mt-24 max-w-7xl md:mt-36">
        <FadeUp>
          <p
            className="max-w-5xl font-display text-4xl font-extrabold leading-[1.02] tracking-[-0.04em] sm:text-6xl lg:text-7xl"
            style={{ color: G.rani }}
          >
            The best garba nights start with “okay, I’m in.”
          </p>
        </FadeUp>
        <div className="mt-6 space-y-1 font-display text-4xl font-extrabold leading-[1.02] tracking-[-0.04em] sm:text-6xl lg:text-7xl">
          {MORE.map((line, i) => (
            <motion.p
              key={line}
              style={{ color: G.rani }}
              initial={{ opacity: 0, x: -40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.8 }}
              transition={{ duration: 0.8, delay: i * 0.12, ease: EASE_OUT }}
            >
              {line}
            </motion.p>
          ))}
        </div>
        <FadeUp delay={0.2} className="mt-16 md:mt-24">
          <p className="relative inline-block text-4xl font-bold italic tracking-[-0.03em] sm:text-6xl" style={{ color: G.rani }}>
            Welcome to Kollide.
            <svg viewBox="0 0 300 20" preserveAspectRatio="none" className="absolute -bottom-3 left-0 h-4 w-full overflow-visible" aria-hidden>
              <motion.path
                d="M 4 12 C 80 4, 200 18, 296 8"
                fill="none"
                stroke={G.marigold}
                strokeWidth="4"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
                initial={{ pathLength: 0 }}
                whileInView={{ pathLength: 1 }}
                viewport={{ once: true, amount: 0.8 }}
                transition={{ duration: 0.8, delay: 0.5, ease: 'easeInOut' }}
              />
            </svg>
          </p>
        </FadeUp>
      </div>
    </section>
  )
}
