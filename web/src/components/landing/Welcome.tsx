import { motion } from 'motion/react'
import Collision from './Collision'
import { G } from './garba'
import { EASE_OUT } from './motion'
import { FadeUp } from './Reveal'

const BIG = 'font-display text-4xl font-extrabold leading-[1.02] tracking-[-0.04em] sm:text-5xl lg:text-[3.6rem]'
// The supporting line under the headline: same face and colour, a step down.
const LEAD = 'font-display text-2xl font-bold leading-[1.15] tracking-[-0.03em] sm:text-3xl lg:text-[2.1rem]'

/**
 * Right after the hero: what Kollide is for, a big headline and one line
 * under it, signed off with "Welcome to Kollide…", beside the collision:
 * two people going solo become a +1, then a crew.
 */
export default function Welcome() {
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

        <Collision />
      </div>
    </section>
  )
}
