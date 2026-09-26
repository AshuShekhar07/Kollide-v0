import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
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

const TRUST_POINTS = [
  {
    title: 'Every profile is verified',
    body: 'Members record a short face video that our team reviews before they can be seen or matched.',
  },
  {
    title: 'Private chat',
    body: 'Your messages are private. If a conversation is reported, our safety team reviews it to investigate.',
  },
  {
    title: 'Block and report, instantly',
    body: 'Block anyone in one tap. Reports go straight to our safety team, and bans stick.',
  },
]

export default function Landing() {
  const [comingSoon, setComingSoon] = useState<Activity[]>(FALLBACK_COMING_SOON)

  useEffect(() => {
    supabase
      .from('activities')
      .select('slug, name, status')
      .eq('status', 'coming_soon')
      .order('sort_order')
      .then(({ data }) => {
        if (data?.length) setComingSoon(data as Activity[])
      })
  }, [])

  return (
    <div className="min-h-screen">
      <section className="bg-gradient-to-br from-brand-700 via-brand-600 to-brand-500 px-4 pb-16 pt-6 text-white">
        <div className="mx-auto max-w-3xl">
          <header className="flex items-center justify-between">
            <span className="text-xl font-extrabold tracking-tight">Kollide</span>
            <Link to="/start" className="rounded-full bg-white/15 px-4 py-1.5 text-sm font-semibold hover:bg-white/25">
              Sign in
            </Link>
          </header>

          <p className="mt-14 text-sm font-semibold uppercase tracking-widest text-marigold-400">
            Where paths collide
          </p>
          <h1 className="mt-3 text-4xl font-extrabold leading-tight sm:text-5xl">
            Find your Garba partner or group
          </h1>
          <p className="mt-4 max-w-xl text-lg text-white/85">
            Don't go alone this Navratri. Meet verified people heading to the same Garba nights, as a
            partner, a friend, or a whole group.
          </p>

          <div className="mt-8 max-w-lg">
            <WaitlistForm />
            <p className="mt-3 text-sm text-white/70">Opening Sunday, Oct 4 · Navratri Oct 11–19</p>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-3xl px-4">
        <section className="-mt-8">
          <div className="rounded-3xl border border-brand-100 bg-white p-5 shadow-lg shadow-brand-900/5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-brand-900">Garba &amp; Dandiya</h2>
                <p className="mt-1 text-neutral-600">
                  Sharad Navratri 2026 · Oct 11–19 · Bangalore
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800">
                Live soon
              </span>
            </div>
            <ul className="mt-4 grid gap-2 text-sm text-neutral-700 sm:grid-cols-2">
              <li className="rounded-xl bg-brand-50 px-3 py-2">1:1: find a partner or a friend</li>
              <li className="rounded-xl bg-brand-50 px-3 py-2">Groups: join or start a crew of up to 10</li>
            </ul>
          </div>
        </section>

        <section className="mt-12">
          <h2 className="text-lg font-bold text-brand-900">Coming soon</h2>
          <p className="mt-1 text-sm text-neutral-600">Garba is just the start.</p>
          <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {comingSoon.map((a) => (
              <li
                key={a.slug}
                className="rounded-2xl border border-neutral-200 px-4 py-4 text-sm font-medium text-neutral-700"
              >
                {a.name}
                <span className="mt-1 block text-xs font-normal text-neutral-400">Coming soon</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-12">
          <h2 className="text-lg font-bold text-brand-900">Built for trust</h2>
          <ul className="mt-4 grid gap-3 sm:grid-cols-3">
            {TRUST_POINTS.map((p) => (
              <li key={p.title} className="rounded-2xl bg-neutral-50 p-4">
                <h3 className="font-semibold text-neutral-900">{p.title}</h3>
                <p className="mt-1 text-sm text-neutral-600">{p.body}</p>
              </li>
            ))}
          </ul>
        </section>
      </main>

      <footer className="mx-auto mt-16 max-w-3xl px-4 pb-10 text-sm text-neutral-500">
        © 2026 Kollide · Bangalore
      </footer>
    </div>
  )
}
