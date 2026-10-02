import {
  Check,
  Coffee,
  Dices,
  Music,
  Sparkles,
  UtensilsCrossed,
  type LucideIcon,
} from 'lucide-react'
import { motion } from 'motion/react'
import { useState, type CSSProperties } from 'react'
import { supabase } from '../../lib/supabase'
import { G } from './garba'
import { FadeUp, RevealText } from './Reveal'

export type ComingSoonActivity = { slug: string; name: string }

const ACTIVITY_ICONS: Record<string, LucideIcon> = {
  concerts: Music,
  board_games: Dices,
  cafe_hopping: Coffee,
  food_walks: UtensilsCrossed,
}

const ACTIVITY_LINES: Record<string, string> = {
  concerts: 'Someone to go with when your favourite artist comes to town.',
  board_games: 'Game nights with people who take Catan a little too seriously.',
  cafe_hopping: "The city's best corners, with people who like the same ones.",
  food_walks: "Street food trails with people who never say 'I'm full'.",
}

// Card colours in turn; text on the lighter ones is ink, on the rest cream.
const CARD_COLORS = [
  { bg: G.rani, fg: G.cream },
  { bg: G.marigold, fg: G.ink },
  { bg: G.peacock, fg: G.cream },
  { bg: G.maroon, fg: G.cream },
  { bg: G.haldi, fg: G.ink },
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

/**
 * The coming-soon activities, as garba-coloured cards on the cream page,
 * with a line under them for everything still to come.
 */
export default function WhatsNext({ activities, canVote }: { activities: ComingSoonActivity[]; canVote: boolean }) {
  return (
    <section className="px-5 py-24 sm:px-8 md:py-32 lg:px-12" aria-label="What's coming next">
      <div className="mx-auto max-w-7xl">
        <FadeUp>
          <p className="text-xs font-bold uppercase tracking-[0.22em]" style={{ color: G.rani }}>
            After Navratri
          </p>
        </FadeUp>
        <RevealText
          text="Here's what's coming next…"
          className="mt-4 max-w-4xl font-display text-5xl font-extrabold leading-[0.98] tracking-[-0.04em] sm:text-6xl lg:text-7xl"
        />
        <FadeUp delay={0.1}>
          <p className="mt-6 max-w-lg text-lg leading-relaxed opacity-75">
            Kollide opens up to more ways to meet people. Tell us what you'd use next, and we'll build it first.
          </p>
        </FadeUp>

        {/* Threes when they divide evenly, otherwise fours, so no card sits alone on a row. */}
        <ul className={`mt-14 grid gap-4 sm:grid-cols-2 ${activities.length % 3 === 0 ? 'lg:grid-cols-3' : 'lg:grid-cols-4'}`}>
          {activities.map((a, i) => (
            <ActivityCard key={a.slug} activity={a} index={i} canVote={canVote} />
          ))}
        </ul>

        <FadeUp className="mt-10 flex flex-wrap items-center gap-x-4 gap-y-2">
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
            style={{ backgroundColor: G.maroon, color: G.cream }}
          >
            <Sparkles className="h-5 w-5" />
          </span>
          <p className="font-display text-2xl font-extrabold tracking-[-0.03em] sm:text-3xl">Many more coming soon.</p>
          <p className="text-lg leading-relaxed opacity-75">And your votes decide which one lands first.</p>
        </FadeUp>
      </div>
    </section>
  )
}
