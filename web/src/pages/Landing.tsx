import {
  BadgeCheck,
  Check,
  Coffee,
  Compass,
  Dices,
  Feather,
  Footprints,
  Lock,
  MapPin,
  MessageCircle,
  Mountain,
  Music,
  ShieldCheck,
  Sparkles,
  UserRound,
  UsersRound,
  Video,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card, Logo, Tag } from '../components/ui'
import WaitlistForm from '../components/WaitlistForm'
import { supabase } from '../lib/supabase'

type Activity = { slug: string; name: string; status: 'live' | 'coming_soon' }

// Shown until the activities query returns (or if it fails), so the page
// always reads as multi-event.
const FALLBACK_COMING_SOON: Activity[] = [
  { slug: 'trekking', name: 'Trekking', status: 'coming_soon' },
  { slug: 'badminton', name: 'Badminton', status: 'coming_soon' },
  { slug: 'concerts', name: 'Concerts', status: 'coming_soon' },
  { slug: 'running', name: 'Running clubs', status: 'coming_soon' },
  { slug: 'board_games', name: 'Board game nights', status: 'coming_soon' },
  { slug: 'cafe_hopping', name: 'Cafe hopping', status: 'coming_soon' },
]

const ACTIVITY_ICONS: Record<string, LucideIcon> = {
  trekking: Mountain,
  badminton: Feather,
  concerts: Music,
  running: Footprints,
  board_games: Dices,
  cafe_hopping: Coffee,
}

const STEPS = [
  { icon: Video, title: 'Get verified', body: 'Record a 10-second face video. Our team checks every profile by hand.' },
  { icon: Compass, title: 'Find your people', body: 'Swipe for a friend to go with, or join a group heading out.' },
  { icon: MessageCircle, title: 'Chat and go', body: 'Plan your night, swap socials, and dance till late.' },
]

// Navratri 2026 opens the night of Oct 11 (IST).
const NAVRATRI = new Date('2026-10-11T18:00:00+05:30')

function Countdown() {
  const [days] = useState(() => Math.ceil((NAVRATRI.getTime() - Date.now()) / 86_400_000))
  if (days <= 0) return <span>Navratri is here · Oct 11–19</span>
  return (
    <span>
      <strong className="font-bold text-white">{days}</strong> day{days === 1 ? '' : 's'} to Navratri · Oct 11–19
    </span>
  )
}

const TRUST_POINTS = [
  {
    icon: BadgeCheck,
    title: 'Every profile is verified',
    body: 'Members record a short face video that our team reviews before they can be seen or matched.',
  },
  {
    icon: Lock,
    title: 'Private chat',
    body: 'Your messages are private. If a conversation is reported, our safety team reviews it to investigate.',
  },
  {
    icon: ShieldCheck,
    title: 'Block and report, instantly',
    body: 'Block anyone in one tap. Reports go straight to our safety team, and bans stick.',
  },
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
      className={`mt-3 inline-flex w-full items-center justify-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold transition active:scale-95 ${
        voted ? 'bg-green-100 text-green-800' : 'bg-brand-50 text-brand-700 hover:bg-brand-100'
      }`}
    >
      {voted ? (
        <>
          <Check className="h-3.5 w-3.5" strokeWidth={3} /> Noted, thanks!
        </>
      ) : busy ? (
        'Saving…'
      ) : (
        "I'd want this"
      )}
    </button>
  )
}

export default function Landing() {
  const [comingSoon, setComingSoon] = useState<Activity[]>(FALLBACK_COMING_SOON)
  const [fromDb, setFromDb] = useState(false)

  useEffect(() => {
    supabase
      .from('activities')
      .select('slug, name, status')
      .eq('status', 'coming_soon')
      .order('sort_order')
      .then(({ data }) => {
        if (data?.length) {
          setComingSoon(data as Activity[])
          setFromDb(true)
        }
      })
  }, [])

  return (
    <div className="min-h-screen overflow-x-hidden">
      <section className="relative overflow-hidden bg-gradient-to-br from-plum-700 via-plum-600 to-plum-500 px-4 pb-20 pt-[max(env(safe-area-inset-top),1.5rem)] text-white">
        <div className="bandhani pointer-events-none absolute inset-0 text-white/[0.08]" aria-hidden />
        <div
          className="pointer-events-none absolute -right-16 top-24 h-56 w-56 animate-float rounded-full bg-marigold-400/30 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -left-20 bottom-0 h-64 w-64 animate-float rounded-full bg-brand-300/30 blur-3xl [animation-delay:-3s]"
          aria-hidden
        />
        <div className="relative mx-auto max-w-3xl">
          <header className="flex items-center justify-between">
            <Logo tone="white" className="text-2xl" />
            <Link
              to="/start"
              className="rounded-full bg-white/15 px-4 py-2 text-sm font-semibold ring-1 ring-white/25 backdrop-blur-sm transition hover:bg-white/25 active:scale-95"
            >
              Sign in
            </Link>
          </header>

          <div className="mt-14 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold ring-1 ring-white/20 backdrop-blur-sm">
              <MapPin className="h-3.5 w-3.5" /> Bangalore only, for now
            </span>
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-marigold-300">Where paths collide</span>
          </div>
          <h1 className="mt-4 text-[2.6rem] font-extrabold leading-[1.05] sm:text-6xl">
            Find your{' '}
            <span className="relative inline-block text-marigold-300">
              Garba
              <svg
                className="absolute -bottom-1 left-0 w-full text-marigold-400"
                viewBox="0 0 100 8"
                preserveAspectRatio="none"
                aria-hidden
              >
                <path
                  d="M1 6 Q 25 1 50 5 T 99 3"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              </svg>
            </span>{' '}
            friends or group
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-white/85">
            Don't go alone this Navratri. Meet verified people in Bangalore heading to the same Garba nights, as a
            friend or a whole group.
          </p>

          <div className="mt-8 max-w-lg">
            <WaitlistForm />
            <p className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-white/75">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 animate-pulse rounded-full bg-marigold-400" /> Opening Sunday, Oct 4
              </span>
              <Countdown />
            </p>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-3xl px-4">
        <section className="relative -mt-10">
          <Card className="p-5 shadow-xl shadow-plum-900/10">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-marigold-300 to-marigold-500 text-2xl">
                  💃
                </span>
                <div>
                  <h2 className="text-xl font-bold text-neutral-900">Garba &amp; Dandiya</h2>
                  <p className="text-sm text-neutral-500">Sharad Navratri 2026 · Oct 11–19</p>
                </div>
              </div>
              <Tag tone="green" className="shrink-0">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-500" /> Live soon
              </Tag>
            </div>
            <ul className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
              <li className="flex items-center gap-3 rounded-2xl bg-brand-50 px-3 py-2.5 font-medium text-neutral-800">
                <UserRound className="h-5 w-5 shrink-0 text-brand-600" /> 1:1: find a friend to go with
              </li>
              <li className="flex items-center gap-3 rounded-2xl bg-brand-50 px-3 py-2.5 font-medium text-neutral-800">
                <UsersRound className="h-5 w-5 shrink-0 text-brand-600" /> Groups: join or start a crew of up to 10
              </li>
            </ul>
          </Card>
        </section>

        <section className="mt-14">
          <h2 className="text-2xl font-bold text-neutral-900">How it works</h2>
          <ol className="mt-5 grid gap-3 sm:grid-cols-3">
            {STEPS.map((step, i) => (
              <li
                key={step.title}
                className="relative rounded-3xl border border-neutral-200/80 bg-surface p-5 shadow-sm"
              >
                <span className="absolute right-4 top-3 font-display text-4xl font-extrabold text-neutral-100">
                  {i + 1}
                </span>
                <span className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-plum-500 to-plum-700 text-white shadow-md shadow-plum-600/25">
                  <step.icon className="h-5 w-5" />
                </span>
                <h3 className="relative mt-3 text-lg font-bold text-neutral-900">{step.title}</h3>
                <p className="relative mt-1 text-sm leading-relaxed text-neutral-600">{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-14">
          <h2 className="text-2xl font-bold text-neutral-900">Coming soon</h2>
          <p className="mt-1 text-sm text-neutral-500">Garba is just the start. Tell us what you'd use next.</p>
          <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {comingSoon.map((a) => {
              const Icon = ACTIVITY_ICONS[a.slug] ?? Sparkles
              return (
                <li key={a.slug} className="rounded-3xl border border-neutral-200/80 bg-surface p-4 shadow-sm">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-marigold-100 text-marigold-800">
                    <Icon className="h-5 w-5" />
                  </span>
                  <p className="mt-3 font-semibold text-neutral-900">{a.name}</p>
                  <p className="text-xs text-neutral-400">Coming soon</p>
                  {fromDb && <VoteButton slug={a.slug} />}
                </li>
              )
            })}
          </ul>
        </section>

        <section className="mt-14">
          <h2 className="text-2xl font-bold text-neutral-900">Built for trust</h2>
          <ul className="mt-5 grid gap-3 sm:grid-cols-3">
            {TRUST_POINTS.map((p) => (
              <li key={p.title} className="flex gap-4 rounded-3xl bg-neutral-100/70 p-5 sm:flex-col sm:gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-surface text-brand-600 shadow-sm">
                  <p.icon className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="font-bold text-neutral-900">{p.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-neutral-600">{p.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="relative mt-14 overflow-hidden rounded-[2rem] bg-gradient-to-br from-plum-600 to-plum-800 p-6 text-center text-white">
          <div className="bandhani pointer-events-none absolute inset-0 text-white/[0.07]" aria-hidden />
          <div className="relative">
            <p className="font-display text-2xl font-bold">Don't go alone this Navratri</p>
            <p className="mt-1 text-sm text-white/75">Join the waitlist and we'll tell you the moment we open.</p>
            <div className="mx-auto mt-5 max-w-md text-left">
              <WaitlistForm id="waitlist-email-bottom" />
            </div>
          </div>
        </section>
      </main>

      <footer className="mx-auto mt-14 max-w-3xl px-4 pb-10 text-sm text-neutral-500">
        <Logo className="text-lg" />
        <p className="mt-2">© 2026 Kollide · Made in Bangalore</p>
        <p className="mt-2 flex gap-4">
          <Link to="/privacy" className="underline underline-offset-2 hover:text-neutral-800">
            Privacy Policy
          </Link>
          <Link to="/terms" className="underline underline-offset-2 hover:text-neutral-800">
            Terms of Service
          </Link>
        </p>
      </footer>
    </div>
  )
}
