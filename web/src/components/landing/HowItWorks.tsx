import { Check } from 'lucide-react'
import { motion, useReducedMotion, useScroll, useTransform, type MotionValue } from 'motion/react'
import { useRef } from 'react'
import { G } from './garba'
import { FadeUp, RevealText } from './Reveal'

const STEPS = [
  {
    title: 'Get verified',
    body: 'Record a 10-second face video. A real person on our team checks it against your photos, usually within 24 hours. You can browse and like while you wait; your likes are delivered the moment you are approved.',
    points: ['10-second face video', 'Checked by a person', 'Usually within 24 hours'],
    photo: '/landing/step-verified.webp',
    alt: 'A fluffy white dog in black goggles, looking very verified',
    position: '50% 45%',
    bg: G.rani,
    fg: G.cream,
  },
  {
    title: 'Find your people',
    body: "Pick the nights you're going and who you'd like to meet. Match with one person to go with, or join a group of up to 10 heading to the same garba. Start your own group and share the invite link.",
    points: ['One-on-one matches', 'Groups of 2 to 10', 'Same night, same ground'],
    photo: '/landing/step-people.webp',
    alt: 'A group of friends in garba outfits laughing under a canopy of coloured fabric',
    position: '50% 62%',
    bg: G.marigold,
    fg: G.ink,
  },
  {
    title: 'Chat and show up',
    body: "Plan the night in chat: where to meet, what to wear, who's bringing the dandiya. When you're ready, swap Instagram or WhatsApp and dance till late.",
    points: ['Private chat', 'Swap socials', 'Block in one tap'],
    photo: '/landing/step-venue.webp',
    alt: 'A festival ground at dusk strung with fabric, flags and fairy lights',
    position: '50% 68%',
    bg: G.peacock,
    fg: G.cream,
  },
]

const clamp = (v: number) => Math.min(Math.max(v, 0), 1)

// One card in the stack. It pins near the top; as later cards slide over it,
// it shrinks back a little so the stack reads as a pile.
function StepCard({ index, progress }: { index: number; progress: MotionValue<number> }) {
  const reduced = useReducedMotion()
  const step = STEPS[index]
  const n = STEPS.length
  const target = 1 - (n - 1 - index) * 0.05
  const scale = useTransform(progress, (p) => (reduced ? 1 : 1 - (1 - target) * clamp((p - index / n) / (1 - index / n))))
  const photoScale = useTransform(progress, (p) => (reduced ? 1 : 1.25 - 0.25 * clamp((p - (index - 0.6) / n) * n)))

  return (
    <div className="sticky top-0 flex h-[100svh] items-center justify-center px-4 sm:px-8">
      <motion.article
        className="bandhani-soft relative grid w-full max-w-6xl origin-top overflow-hidden rounded-[40px] shadow-2xl shadow-[#2A0E1B]/25 md:grid-cols-[1.1fr_1fr]"
        style={{ scale, top: `calc(-4vh + ${index * 26}px)`, backgroundColor: step.bg, color: step.fg }}
      >
        <div className="relative flex flex-col justify-center p-7 sm:p-10 lg:p-14">
          <span
            className="font-display text-7xl font-extrabold leading-none tracking-[-0.04em] sm:text-8xl lg:text-9xl"
            style={{ WebkitTextStroke: `2px ${step.fg}`, color: 'transparent' }}
          >
            {String(index + 1).padStart(2, '0')}
          </span>
          <h3 className="mt-4 font-display text-3xl font-extrabold tracking-[-0.03em] sm:text-4xl lg:text-5xl">{step.title}</h3>
          <p className="mt-4 max-w-md text-base leading-relaxed opacity-85 sm:text-lg">{step.body}</p>
          <ul className="mt-6 flex flex-wrap gap-2">
            {step.points.map((p) => (
              <li
                key={p}
                className="inline-flex items-center gap-1.5 rounded-full border border-current/30 px-3.5 py-1.5 text-sm font-semibold"
              >
                <Check className="h-4 w-4" strokeWidth={3} /> {p}
              </li>
            ))}
          </ul>
        </div>
        <div className="relative hidden overflow-hidden md:block">
          <motion.img
            src={step.photo}
            alt={step.alt}
            loading="lazy"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover"
            style={{ scale: photoScale, objectPosition: step.position }}
          />
        </div>
      </motion.article>
    </div>
  )
}

/**
 * How it works, as a stack of colourful cards: each one pins and the next
 * slides up over it, like invites piling up before a big night.
 */
export default function HowItWorks() {
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] })

  return (
    <section id="how-it-works" className="relative pt-24 md:pt-32" aria-label="How it works">
      <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-12">
        <FadeUp>
          <p className="text-xs font-bold uppercase tracking-[0.22em]" style={{ color: G.rani }}>
            How it works
          </p>
        </FadeUp>
        <RevealText
          text="From your couch to the circle in three steps."
          className="mt-4 max-w-4xl font-display text-5xl font-extrabold leading-[0.98] tracking-[-0.04em] sm:text-6xl lg:text-7xl"
        />
      </div>
      <div ref={ref} className="relative mt-4">
        {STEPS.map((s, i) => (
          <StepCard key={s.title} index={i} progress={scrollYProgress} />
        ))}
      </div>
    </section>
  )
}
