import { motion } from 'motion/react'
import { EASE_OUT } from './motion'

const RED = '#FF2A26'
const TEXT = '#FFF6EC'

/**
 * Why Kollide, in one red band: the question on the left, the answer in two
 * lines beside it. The band opens out from the middle as it scrolls in.
 */
export default function WhyKollide() {
  return (
    // The section carries the trigger: the band, clipped to a sliver, would
    // never count as in view by itself.
    <motion.section
      aria-label="Why Kollide?"
      className="px-4 py-10 sm:px-6 md:py-14 lg:px-8"
      initial="hidden"
      whileInView="shown"
      viewport={{ once: true, amount: 0.5 }}
    >
      <motion.div
        className="bandhani-soft mx-auto grid max-w-7xl items-center gap-4 rounded-[28px] px-7 py-9 sm:px-10 md:grid-cols-[auto_1fr] md:gap-14 md:px-14 md:py-12"
        style={{ backgroundColor: RED, color: TEXT }}
        variants={{
          hidden: { clipPath: 'inset(0 46% round 28px)' },
          shown: { clipPath: 'inset(0 0% round 28px)', transition: { duration: 0.9, ease: EASE_OUT } },
        }}
      >
        <motion.h2
          className="whitespace-nowrap font-display text-4xl font-extrabold leading-none tracking-[-0.04em] sm:text-5xl lg:text-6xl"
          variants={{ hidden: { opacity: 0, y: 16 }, shown: { opacity: 1, y: 0, transition: { duration: 0.6, delay: 0.35, ease: EASE_OUT } } }}
        >
          Why Kollide?
        </motion.h2>
        <motion.p
          className="max-w-3xl text-lg font-semibold leading-snug sm:text-xl lg:text-2xl"
          variants={{ hidden: { opacity: 0, y: 16 }, shown: { opacity: 1, y: 0, transition: { duration: 0.6, delay: 0.5, ease: EASE_OUT } } }}
        >
          Stop waiting for your friends to be free. Kollide finds you verified people going to the same garba, so the
          plan actually happens.
        </motion.p>
      </motion.div>
    </motion.section>
  )
}
