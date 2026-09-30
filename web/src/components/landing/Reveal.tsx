import { motion, type Variants } from 'motion/react'
import type { ReactNode } from 'react'
import { EASE_OUT } from './motion'

const wordsParent: Variants = {
  hidden: {},
  shown: (delay: number) => ({ transition: { staggerChildren: 0.045, delayChildren: delay } }),
}

const word: Variants = {
  hidden: { y: '110%' },
  shown: { y: '0%', transition: { duration: 0.8, ease: EASE_OUT } },
}

type Tag = 'h1' | 'h2' | 'h3' | 'p' | 'span'

/**
 * A heading whose words slide up from behind a mask, one after another.
 * Plays once when scrolled into view, or when `play` turns true if given.
 */
export function RevealText({
  text,
  as = 'h2',
  className,
  play,
  delay = 0,
  accent,
  accentClassName = '',
}: {
  text: string
  as?: Tag
  className?: string
  play?: boolean
  delay?: number
  /** Words (matched without punctuation) to style with `accentClassName`. */
  accent?: string[]
  accentClassName?: string
}) {
  const Component = motion[as]
  const trigger =
    play === undefined
      ? { whileInView: 'shown', viewport: { once: true, amount: 0.6 } }
      : { animate: play ? 'shown' : 'hidden' }

  return (
    <Component className={className} initial="hidden" variants={wordsParent} custom={delay} {...trigger}>
      <span className="sr-only">{text}</span>
      <span aria-hidden>
        {text.split(' ').map((w, i) => (
          <span key={i}>
            <span className="-mb-[0.14em] inline-block overflow-hidden pb-[0.14em] align-top">
              <motion.span
                className={`inline-block will-change-transform ${
                  accent?.includes(w.replace(/[^\p{L}\p{N}']/gu, '')) ? accentClassName : ''
                }`}
                variants={word}
              >
                {w}
              </motion.span>
            </span>{' '}
          </span>
        ))}
      </span>
    </Component>
  )
}

/** Fades content up ~28px when it scrolls into view (or when `play` turns true). */
export function FadeUp({
  children,
  className,
  delay = 0,
  play,
}: {
  children: ReactNode
  className?: string
  delay?: number
  play?: boolean
}) {
  const shown = { opacity: 1, y: 0 }
  const trigger =
    play === undefined
      ? { whileInView: shown, viewport: { once: true, amount: 0.25 } }
      : { animate: play ? shown : undefined }

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 28 }}
      transition={{ duration: 0.8, ease: EASE_OUT, delay }}
      {...trigger}
    >
      {children}
    </motion.div>
  )
}
