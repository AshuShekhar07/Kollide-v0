import {
  Check,
  Coffee,
  Dices,
  Music,
  Sparkles,
  type LucideIcon,
} from 'lucide-react'
import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react'
import { useRef, useState, type CSSProperties } from 'react'
import { supabase } from '../../lib/supabase'
import { G } from './garba'
import { FadeUp, RevealText } from './Reveal'
import Toran from './Toran'

export type ComingSoonActivity = { slug: string; name: string }

const ACTIVITY_ICONS: Record<string, LucideIcon> = {
  concerts: Music,
  board_games: Dices,
  cafe_hopping: Coffee,
}

const ACTIVITY_LINES: Record<string, string> = {
  concerts: 'Someone to go with when your favourite artist comes to town.',
  board_games: 'Game nights with people who take Catan a little too seriously.',
  cafe_hopping: "The city's best corners, with people who like the same ones.",
}

// Card colours in turn; text on the lighter ones is ink, on the rest cream.
const CARD_COLORS = [
  { bg: G.rani, fg: G.cream },
  { bg: G.marigold, fg: G.ink },
  { bg: G.peacock, fg: G.cream },
  { bg: G.haldi, fg: G.ink },
  { bg: G.maroon, fg: G.cream },
  { bg: G.leaf, fg: G.cream },
]

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
function VoteButton({ slug, bg, fg }: { slug: string; bg: string; fg: string }) {
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
      style={{ '--vote-bg': bg, '--vote-fg': fg } as CSSProperties}
      className={`inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full px-5 py-2.5 text-sm font-bold transition active:scale-95 ${
        voted
          ? 'bg-(--vote-fg) text-(--vote-bg)'
          : 'border-2 border-current/45 hover:border-transparent hover:bg-(--vote-fg) hover:text-(--vote-bg)'
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

/**
 * The full-screen beat: a maroon card under a toran, the question sliding up
 * word by word, then the answer. It stays pinned while the list slides over,
 * sinking back a little, like the How it works cards.
 */
function Question({ cover }: { cover: ReturnType<typeof useScroll>['scrollYProgress'] }) {
  const reduced = useReducedMotion()
  const scale = useTransform(cover, [0, 1], reduced ? [1, 1] : [1, 0.94])

  return (
    <div className="sticky top-0 flex h-[100svh] items-center justify-center px-4 sm:px-6">
      <motion.div
        className="bandhani-soft relative flex h-[88svh] max-h-[52rem] w-full max-w-7xl origin-top flex-col overflow-hidden rounded-[40px] shadow-2xl shadow-[#2A0E1B]/25"
        style={{ scale, backgroundColor: G.maroon, color: G.cream }}
      >
        <Toran count={32} className="shrink-0 text-[#FFF4E4]" />
        <div className="relative flex flex-1 flex-col justify-center px-6 sm:px-12 lg:px-16">
          <h2 className="font-display font-extrabold leading-[0.92] tracking-[-0.045em] text-[3.6rem] sm:text-8xl lg:text-[9.5rem]">
            <RevealText as="span" text="That's it?" className="block" />
            <RevealText
              as="span"
              text="Just Garba?"
              delay={0.25}
              className="block"
              accent={['Garba']}
              accentClassName="italic pr-[0.12em]"
            />
          </h2>
          <FadeUp delay={0.9} className="mt-10 md:mt-14">
            <p className="text-2xl font-bold tracking-[-0.02em] sm:text-4xl">
              Not even close.{' '}
              <span className="relative inline-block">
                Here's what's next.
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
                    transition={{ duration: 0.8, delay: 1.5, ease: 'easeInOut' }}
                  />
                </svg>
              </span>
            </p>
          </FadeUp>
        </div>
      </motion.div>
    </div>
  )
}

function ActivityCard({
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
  const { bg, fg } = CARD_COLORS[index % CARD_COLORS.length]

  return (
    <motion.li
      className="group bandhani-soft relative flex min-h-[19rem] flex-col overflow-hidden rounded-[32px] p-7 sm:p-8"
      style={{ backgroundColor: bg, color: fg }}
      initial={{ opacity: 0, y: 48, rotate: index % 2 ? 2 : -2 }}
      whileInView={{ opacity: 1, y: 0, rotate: 0 }}
      whileHover={{ y: -6, rotate: index % 2 ? 0.6 : -0.6 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ type: 'spring', stiffness: 140, damping: 18, delay: (index % 3) * 0.08 }}
    >
      <div className="flex items-start justify-between gap-4">
        <span
          className="flex h-12 w-12 items-center justify-center rounded-2xl transition-transform duration-700 group-hover:rotate-[360deg]"
          style={{ backgroundColor: 'rgb(255 255 255 / 0.18)' }}
        >
          <Icon className="h-6 w-6" />
        </span>
        <span
          className="font-display text-6xl font-extrabold leading-none tracking-[-0.04em]"
          style={{ WebkitTextStroke: `2px ${fg}`, color: 'transparent' }}
          aria-hidden
        >
          {String(index + 1).padStart(2, '0')}
        </span>
      </div>
      <h3 className="mt-8 font-display text-3xl font-extrabold tracking-[-0.03em] sm:text-4xl">{activity.name}</h3>
      <p className="mt-3 max-w-sm leading-relaxed opacity-85">{line}</p>
      <div className="mt-auto pt-7">
        {canVote ? (
          <VoteButton slug={activity.slug} bg={bg} fg={fg} />
        ) : (
          <span className="inline-block rounded-full border-2 border-current/45 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em]">
            Soon
          </span>
        )}
      </div>
    </motion.li>
  )
}

// The last tile: more is on the way. Cream with a dashed edge, so it reads as
// a place still to be filled, next to the coloured ones.
function MoreCard({ index }: { index: number }) {
  return (
    <motion.li
      className="group relative flex min-h-[19rem] flex-col overflow-hidden rounded-[32px] border-2 border-dashed p-7 sm:p-8"
      style={{ borderColor: 'rgb(42 14 27 / 0.3)', color: G.ink }}
      initial={{ opacity: 0, y: 48, rotate: index % 2 ? 2 : -2 }}
      whileInView={{ opacity: 1, y: 0, rotate: 0 }}
      whileHover={{ y: -6, rotate: index % 2 ? 0.6 : -0.6 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ type: 'spring', stiffness: 140, damping: 18, delay: (index % 3) * 0.08 }}
    >
      <div className="flex items-start justify-between gap-4">
        <span
          className="flex h-12 w-12 items-center justify-center rounded-2xl transition-transform duration-700 group-hover:rotate-[360deg]"
          style={{ backgroundColor: G.maroon, color: G.cream }}
        >
          <Sparkles className="h-6 w-6" />
        </span>
        <span
          className="font-display text-6xl font-extrabold leading-none tracking-[-0.04em]"
          style={{ WebkitTextStroke: `2px ${G.ink}`, color: 'transparent' }}
          aria-hidden
        >
          +
        </span>
      </div>
      <h3 className="mt-8 font-display text-3xl font-extrabold tracking-[-0.03em] sm:text-4xl">Many more coming soon</h3>
      <p className="mt-3 max-w-sm leading-relaxed opacity-75">And your votes decide which one lands first.</p>
    </motion.li>
  )
}

/**
 * "That's it? Just Garba?" on a pinned maroon card, then the coming-soon
 * activities as garba-coloured cards on the cream page, sliding up over it.
 */
export default function WhatsNext({ activities, canVote }: { activities: ComingSoonActivity[]; canVote: boolean }) {
  const listRef = useRef<HTMLElement>(null)
  const reduced = useReducedMotion()
  // The card sinks back slightly as the list covers it.
  const { scrollYProgress } = useScroll({ target: listRef, offset: ['start end', 'start start'] })
  const radius = useTransform(scrollYProgress, [0, 1], reduced ? [0, 0] : [48, 0])

  return (
    <div className="relative">
      <Question cover={scrollYProgress} />
      <motion.section
        ref={listRef}
        className="relative z-10 pb-24 pt-20 shadow-[0_-24px_60px_-24px_rgb(42_14_27/0.35)] md:pb-32 md:pt-28"
        style={{ backgroundColor: G.cream, borderTopLeftRadius: radius, borderTopRightRadius: radius }}
        aria-label="What's next"
      >
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-12">
          <FadeUp>
            <p className="text-xs font-bold uppercase tracking-[0.22em]" style={{ color: G.rani }}>
              After Navratri
            </p>
          </FadeUp>
          <RevealText
            text="What's next."
            className="mt-4 font-display text-5xl font-extrabold leading-[0.98] tracking-[-0.04em] sm:text-6xl lg:text-7xl"
          />
          <FadeUp delay={0.1}>
            <p className="mt-6 max-w-lg text-lg leading-relaxed opacity-75">
              Kollide opens up to more ways to meet people. Tell us what you'd use next, and we'll build it first.
            </p>
          </FadeUp>

          {/* Threes when they divide evenly, otherwise fours, so no card sits alone on a row. */}
          <ul
            className={`mt-14 grid gap-4 sm:grid-cols-2 ${(activities.length + 1) % 3 === 0 ? 'lg:grid-cols-3' : 'lg:grid-cols-4'}`}
          >
            {activities.map((a, i) => (
              <ActivityCard key={a.slug} activity={a} index={i} canVote={canVote} />
            ))}
            <MoreCard index={activities.length} />
          </ul>
        </div>
      </motion.section>
    </div>
  )
}
