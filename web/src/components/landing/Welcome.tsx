import { motion, useReducedMotion, useScroll, useTransform, type MotionValue } from 'motion/react'
import { useRef } from 'react'
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

const BIG = 'font-display text-4xl font-extrabold leading-[1.02] tracking-[-0.04em] sm:text-5xl lg:text-[3.6rem]'
// The supporting line under the headline: same face and colour, a step down.
const LEAD = 'font-display text-2xl font-bold leading-[1.15] tracking-[-0.03em] sm:text-3xl lg:text-[2.1rem]'

/**
 * Right after the hero: what Kollide is for, a big headline and one line
 * under it, signed off with "Welcome to Kollide…", beside a fanned stack of
 * garba photos.
 */
export default function Welcome() {
  const stackRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: stackRef, offset: ['start end', 'center 0.6'] })

  return (
    <section id="welcome" aria-label="Welcome to Kollide" className="px-5 py-24 sm:px-8 md:py-32 lg:px-12">
      <div className="mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
        <div style={{ color: G.rani }}>
          <FadeUp>
            <p className={BIG}>Don’t just go to the event. Find your people.</p>
          </FadeUp>
          <motion.p
            className={`mt-7 max-w-[34rem] ${LEAD}`}
            initial={{ opacity: 0, x: -40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.8 }}
            transition={{ duration: 0.8, delay: 0.12, ease: EASE_OUT }}
          >
            Kollide matches you with people who want to experience the same things you do, because the best memories
            are made together.
          </motion.p>
          <FadeUp delay={0.2} className="mt-12 md:mt-16">
            <p className="relative inline-block text-4xl font-bold italic tracking-[-0.03em] sm:text-5xl">
              Welcome to Kollide…
              <svg
                viewBox="0 0 300 20"
                preserveAspectRatio="none"
                className="absolute -bottom-3 left-0 h-4 w-full overflow-visible"
                aria-hidden
              >
                <motion.path
                  d="M 4 12 C 80 4, 200 18, 296 8"
                  fill="none"
                  stroke={G.marigold}
                  strokeWidth="4"
                  strokeLinecap="round"
                  initial={{ pathLength: 0 }}
                  whileInView={{ pathLength: 1 }}
                  viewport={{ once: true, amount: 0.8 }}
                  transition={{ duration: 0.8, delay: 0.5, ease: 'easeInOut' }}
                />
              </svg>
            </p>
          </FadeUp>
        </div>

        <div ref={stackRef} className="relative h-[26rem] w-full sm:h-[32rem] lg:h-[36rem]">
          {CARDS.map((card, i) => (
            <StackCard key={card.src} card={card} index={i} progress={scrollYProgress} />
          ))}
        </div>
      </div>
    </section>
  )
}
