import {
  Check,
  Coffee,
  Dices,
  Feather,
  Footprints,
  Mountain,
  Music,
  Sparkles,
  type LucideIcon,
} from 'lucide-react'
import { motion, useInView, useReducedMotion, useScroll, useTransform } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { EASE_OUT } from './motion'
import { FadeUp, RevealText } from './Reveal'

export type ComingSoonActivity = { slug: string; name: string }

const ACTIVITY_ICONS: Record<string, LucideIcon> = {
  trekking: Mountain,
  badminton: Feather,
  concerts: Music,
  running: Footprints,
  board_games: Dices,
  cafe_hopping: Coffee,
}

const ACTIVITY_LINES: Record<string, string> = {
  trekking: 'Weekend treks out of Bangalore with people who keep your pace.',
  badminton: 'A partner for evening rallies, or a doubles four that actually shows up.',
  concerts: 'Someone to go with when your favourite artist comes to town.',
  running: 'Early-morning runs with a crew that keeps you honest.',
  board_games: 'Game nights with people who take Catan a little too seriously.',
  cafe_hopping: "The city's best corners, with people who like the same ones.",
}

const VOTES_KEY = 'kollide:votes'

function readVotes(): string[] {
  try {
    return JSON.parse(localStorage.getItem(VOTES_KEY) ?? '[]')
  } catch {
    return []
  }
}

// "I'd want this" (§6.1): logged as a coming_soon_vote event. The browser
// remembers its own votes so the button stays ticked.
function VoteButton({ slug }: { slug: string }) {
  const [voted, setVoted] = useState(() => readVotes().includes(slug))
  const [busy, setBusy] = useState(false)

  async function vote() {
    setBusy(true)
    const { error } = await supabase.rpc('vote_coming_soon', { p_slug: slug })
    setBusy(false)
    if (error) return
    setVoted(true)
    try {
      localStorage.setItem(VOTES_KEY, JSON.stringify([...new Set([...readVotes(), slug])]))
    } catch {
      /* storage unavailable; the vote still counted */
    }
  }

  return (
    <button
      type="button"
      onClick={vote}
      disabled={voted || busy}
      className={`inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full px-5 py-2.5 text-sm font-semibold transition active:scale-95 ${
        voted
          ? 'bg-[#fff] text-[#111]'
          : 'border border-[#fff]/30 text-[#fff] hover:bg-[#fff] hover:text-[#111] group-hover:border-[#111]/40 group-hover:text-[#111]'
      }`}
    >
      {voted ? (
        <>
          <Check className="h-4 w-4" strokeWidth={3} /> Noted, thanks!
        </>
      ) : busy ? (
        'Saving…'
      ) : (
        "I'd want this"
      )}
    </button>
  )
}

// Types `text` one character at a time once it scrolls into view.
function useTypewriter(text: string, start: boolean, speed = 70) {
  const reduced = useReducedMotion()
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (!start || reduced) return
    const id = window.setInterval(() => {
      setCount((c) => {
        if (c >= text.length) {
          window.clearInterval(id)
          return c
        }
        return c + 1
      })
    }, speed)
    return () => window.clearInterval(id)
  }, [start, reduced, text, speed])
  return reduced ? text.length : count
}

const QUESTION = "That's it?\nJust Garba?"

// The full-screen orange beat: the question types itself out, then the
// answer ("what's next") appears. It stays pinned while the list slides over.
function Question() {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, amount: 0.55 })
  const count = useTypewriter(QUESTION, inView)
  const done = count >= QUESTION.length
  const typed = QUESTION.slice(0, count)
  const [line1, line2 = ''] = typed.split('\n')

  return (
    <div ref={ref} className="sticky top-0 flex h-[100svh] items-center overflow-hidden bg-[#E0661A] text-[#111]">
      <div className="mx-auto w-full max-w-7xl px-5 sm:px-8 lg:px-12">
        <h2 aria-label="That's it? Just Garba?" className="font-display font-extrabold leading-[0.9] tracking-[-0.045em]">
          <span aria-hidden className="block text-[3.6rem] sm:text-8xl lg:text-[10rem]">
            {line1}
            {!typed.includes('\n') && <Caret />}
          </span>
          <span aria-hidden className="block min-h-[1em] text-[3.6rem] sm:text-8xl lg:text-[10rem]">
            {line2}
            {typed.includes('\n') && <Caret />}
          </span>
        </h2>
        <motion.p
          className="mt-10 max-w-md text-xl font-semibold leading-snug sm:text-2xl"
          initial={{ opacity: 0, y: 20 }}
          animate={done ? { opacity: 1, y: 0 } : undefined}
          transition={{ duration: 0.8, ease: EASE_OUT, delay: 0.3 }}
        >
          Not even close. Here's what's next.
        </motion.p>
      </div>
    </div>
  )
}

function Caret() {
  return <span className="ml-1 inline-block h-[0.8em] w-[0.08em] translate-y-[0.08em] animate-pulse bg-[#111]" />
}

function EventRow({
  activity,
  index,
  canVote,
}: {
  activity: ComingSoonActivity
  index: number
  canVote: boolean
}) {
  const Icon = ACTIVITY_ICONS[activity.slug] ?? Sparkles
  const line = ACTIVITY_LINES[activity.slug] ?? 'Coming after Navratri.'
  const from = index % 2 === 0 ? -60 : 60

  return (
    <li className="group relative border-t border-[#fff]/15">
      {/* Orange fill that wipes in on hover. */}
      <span
        className="pointer-events-none absolute inset-0 origin-left scale-x-0 bg-[#E0661A] transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-x-100"
        aria-hidden
      />
      <motion.div
        className="relative flex flex-col gap-5 px-5 py-8 transition-colors duration-300 group-hover:text-[#111] sm:px-8 md:flex-row md:items-center md:gap-10 md:py-10 lg:px-12"
        initial={{ opacity: 0, x: from }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true, amount: 0.5 }}
        transition={{ duration: 0.9, ease: EASE_OUT }}
      >
        <span className="w-10 font-mono text-sm text-[#E0661A] transition-colors group-hover:text-[#111]">
          {String(index + 1).padStart(2, '0')}
        </span>
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#fff]/10 transition-colors group-hover:bg-[#111] group-hover:text-[#E0661A]">
          <Icon className="h-6 w-6" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-4xl font-extrabold leading-none tracking-[-0.03em] sm:text-5xl lg:text-6xl">
            {activity.name}
          </h3>
          <p className="mt-3 max-w-xl text-[#fff]/60 transition-colors group-hover:text-[#111]/80">{line}</p>
        </div>
        {canVote ? (
          <VoteButton slug={activity.slug} />
        ) : (
          <span className="shrink-0 rounded-full border border-[#fff]/25 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] transition-colors group-hover:border-[#111]/40">
            Soon
          </span>
        )}
      </motion.div>
    </li>
  )
}

function Marquee({ names }: { names: string[] }) {
  const items = [...names, ...names]
  return (
    <div className="relative mt-14 overflow-hidden py-4" aria-hidden>
      <div className="flex w-max animate-marquee items-center">
        {items.map((name, i) => (
          <span key={i} className="flex items-center">
            <span className="text-outline-orange whitespace-nowrap px-6 font-display text-6xl font-extrabold tracking-[-0.02em] sm:text-8xl">
              {name}
            </span>
            <span className="h-3 w-3 shrink-0 rounded-full bg-[#fff]" />
          </span>
        ))}
      </div>
    </div>
  )
}

/**
 * "That's it? Just Garba?" on a full orange screen, then the coming-soon
 * activities on black, sliding up over it.
 */
export default function WhatsNext({ activities, canVote }: { activities: ComingSoonActivity[]; canVote: boolean }) {
  const listRef = useRef<HTMLElement>(null)
  const reduced = useReducedMotion()
  // The orange screen sinks back slightly as the list covers it.
  const { scrollYProgress } = useScroll({ target: listRef, offset: ['start end', 'start start'] })
  const radius = useTransform(scrollYProgress, [0, 1], reduced ? [0, 0] : [48, 0])

  return (
    <div className="relative">
      <Question />
      <motion.section
        ref={listRef}
        className="relative z-10 bg-[#111] pb-24 pt-20 text-[#fff] md:pb-32 md:pt-28"
        style={{ borderTopLeftRadius: radius, borderTopRightRadius: radius }}
        aria-label="What's next"
      >
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-12">
          <FadeUp>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#E0661A]">After Navratri</p>
          </FadeUp>
          <RevealText
            text="What's next."
            className="mt-4 font-display text-6xl font-extrabold leading-[0.95] tracking-[-0.04em] sm:text-8xl"
          />
          <FadeUp delay={0.1}>
            <p className="mt-6 max-w-lg text-lg leading-relaxed text-[#fff]/65">
              Kollide opens up to more ways to meet people. Tell us what you'd use next, and we'll build it first.
            </p>
          </FadeUp>
        </div>

        <Marquee names={activities.map((a) => a.name)} />

        <ul className="mt-14 border-b border-[#fff]/15">
          {activities.map((a, i) => (
            <EventRow key={a.slug} activity={a} index={i} canVote={canVote} />
          ))}
        </ul>
      </motion.section>
    </div>
  )
}
