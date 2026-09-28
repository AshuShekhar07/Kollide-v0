import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react'
import { useRef } from 'react'
import { G } from './garba'
import { EASE_OUT } from './motion'
import { FadeUp, RevealText } from './Reveal'

// Sharad Navratri 2026: nine nights, Sunday Oct 11 to Monday Oct 19.
const NIGHTS = Array.from({ length: 9 }, (_, i) => {
  const d = new Date(2026, 9, 11 + i)
  return {
    day: d.toLocaleDateString('en-IN', { weekday: 'short' }),
    date: d.getDate(),
  }
})

const COLORS = [G.rani, G.marigold, G.peacock, G.haldi, G.maroon, G.leaf, G.orange, G.rani, G.peacock]
// Text on the lighter chips is ink; on the rest it's cream.
const LIGHT = new Set<string>([G.marigold, G.haldi])

/**
 * The nine nights of Navratri arranged as a garba circle. The ring turns as
 * you scroll past (the way the circle moves on the ground) while each night
 * stays upright.
 */
export default function NineNights() {
  const ref = useRef<HTMLElement>(null)
  const reduced = useReducedMotion()
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] })
  const spin = useTransform(scrollYProgress, (p) => (reduced ? 0 : -40 + p * 160))
  const upright = useTransform(spin, (r) => -r)

  return (
    <section ref={ref} className="relative overflow-hidden px-5 py-24 sm:px-8 md:py-32 lg:px-12" aria-label="Nine nights">
      <div className="mx-auto grid max-w-7xl items-center gap-16 lg:grid-cols-[1fr_1.05fr]">
        <div>
          <FadeUp>
            <p className="text-xs font-bold uppercase tracking-[0.22em]" style={{ color: G.rani }}>
              Navratri 2026
            </p>
          </FadeUp>
          <RevealText
            text="Nine nights. One big circle."
            className="mt-4 font-display text-5xl font-extrabold leading-[0.98] tracking-[-0.04em] sm:text-6xl lg:text-7xl"
          />
          <FadeUp delay={0.1}>
            <p className="mt-6 max-w-md text-lg leading-relaxed opacity-75">
              From Sunday, October 11 to Monday, October 19, Bangalore dances every night. Tell Kollide which nights
              you're going, and meet people heading to the same ground.
            </p>
          </FadeUp>
          <FadeUp delay={0.2}>
            <dl className="mt-10 grid max-w-md grid-cols-3 gap-4">
              {[
                ['9', 'nights'],
                ['1', 'city'],
                ['0', 'going alone'],
              ].map(([n, label]) => (
                <div key={label} className="rounded-3xl bg-[#fff]/70 px-4 py-4 ring-1 ring-[#2A0E1B]/10">
                  <dt className="sr-only">{label}</dt>
                  <dd>
                    <span className="block font-display text-4xl font-extrabold leading-none" style={{ color: G.maroon }}>
                      {n}
                    </span>
                    <span className="mt-1 block text-sm font-semibold opacity-70">{label}</span>
                  </dd>
                </div>
              ))}
            </dl>
          </FadeUp>
        </div>

        <div className="relative mx-auto aspect-square w-full max-w-[34rem]">
          {/* The ground: a rangoli-style ring of dots. */}
          <div
            className="absolute inset-[9%] rounded-full border-2 border-dashed opacity-30"
            style={{ borderColor: G.maroon }}
            aria-hidden
          />
          <div className="absolute inset-[27%] flex flex-col items-center justify-center rounded-full text-center" style={{ backgroundColor: G.maroon, color: G.cream }}>
            <span className="font-display text-7xl font-extrabold leading-none sm:text-8xl" style={{ color: G.haldi }}>
              9
            </span>
            <span className="mt-1 text-sm font-bold uppercase tracking-[0.2em] sm:text-base">nights</span>
          </div>

          <motion.ol className="absolute inset-0" style={{ rotate: spin }}>
            {NIGHTS.map((n, i) => {
              const angle = (i / NIGHTS.length) * Math.PI * 2 - Math.PI / 2
              const color = COLORS[i]
              return (
                <li
                  key={n.date}
                  className="absolute -ml-8 -mt-8 h-16 w-16 sm:-ml-10 sm:-mt-10 sm:h-20 sm:w-20"
                  style={{ left: `${50 + 41 * Math.cos(angle)}%`, top: `${50 + 41 * Math.sin(angle)}%` }}
                >
                  <motion.div
                    className="flex h-full w-full flex-col items-center justify-center rounded-full shadow-lg shadow-[#2A0E1B]/20"
                    style={{ rotate: upright, backgroundColor: color, color: LIGHT.has(color) ? G.ink : G.cream }}
                    initial={{ scale: 0 }}
                    whileInView={{ scale: 1 }}
                    whileHover={{ scale: 1.12 }}
                    viewport={{ once: true, amount: 0.6 }}
                    transition={{ type: 'spring', stiffness: 260, damping: 18, delay: i * 0.06 }}
                  >
                    <span className="text-[10px] font-bold uppercase tracking-wider opacity-80 sm:text-xs">{n.day}</span>
                    <span className="font-display text-xl font-extrabold leading-none sm:text-2xl">{n.date}</span>
                  </motion.div>
                </li>
              )
            })}
          </motion.ol>
          <motion.p
            className="absolute inset-x-0 -bottom-4 text-center text-sm font-semibold opacity-60"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 0.6 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, ease: EASE_OUT, delay: 0.7 }}
          >
            October 2026
          </motion.p>
        </div>
      </div>
    </section>
  )
}
