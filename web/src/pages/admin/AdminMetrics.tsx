import { useCallback, useEffect, useState, type ReactNode } from 'react'
import AdminNav from '../../components/AdminNav'
import { Button, ErrorText, Spinner } from '../../components/ui'
import { friendlyError } from '../../lib/errors'
import { supabase } from '../../lib/supabase'

// admin_metrics returns jsonb; this is its shape.
type Metrics = {
  generated_at: string
  funnel: { name: string; users: number; events: number; last_24h: number }[]
  votes: { activity: string; votes: number; signed_in: number }[]
  now: {
    profiles: number
    approved: number
    pending_review: number
    oldest_pending: string | null
    open_reports: number
    banned: number
    matches: number
    open_groups: number
    messages_24h: number
    videos_awaiting_cleanup: number
  }
}

const FUNNEL_LABELS: Record<string, string> = {
  signup: 'Signed up',
  onboarding_complete: 'Finished onboarding',
  video_submitted: 'Submitted video',
  verified: 'Verified',
  first_like: 'Sent a first like',
  first_match: 'Got a first match',
  chat_cap_reached: 'Used a whole chat',
  group_created: 'Created a group',
  group_joined: 'Joined a group',
}

function hoursSince(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000)
}

function Stat({ label, value, warn }: { label: string; value: ReactNode; warn?: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 ${warn ? 'border-red-200 bg-red-50' : 'border-neutral-200 bg-white'}`}>
      <p className="text-xs font-medium text-neutral-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${warn ? 'text-red-700' : 'text-neutral-900'}`}>{value}</p>
    </div>
  )
}

export default function AdminMetrics() {
  const [m, setM] = useState<Metrics | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    const { data, error } = await supabase.rpc('admin_metrics')
    if (error) return setError(friendlyError(error))
    setM(data as unknown as Metrics)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const top = m?.funnel[0]?.users || 0
  const queueAge = m?.now.oldest_pending ? hoursSince(m.now.oldest_pending) : null

  return (
    <main className="mx-auto max-w-5xl px-4 pb-16 pt-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="text-lg font-extrabold tracking-tight text-brand-700">Kollide admin</span>
          <h1 className="text-2xl font-bold text-neutral-900">Metrics</h1>
        </div>
        <div className="flex items-center gap-3">
          <AdminNav />
          <Button variant="secondary" className="px-3 py-1.5 text-sm" onClick={load}>
            Refresh
          </Button>
        </div>
      </header>

      <div className="mt-4">
        <ErrorText>{error}</ErrorText>
      </div>
      {!m && !error && <Spinner />}
      {m && (
        <>
          <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Profiles" value={m.now.profiles} />
            <Stat label="Verified" value={m.now.approved} />
            <Stat
              label="Waiting for review"
              value={queueAge === null ? m.now.pending_review : `${m.now.pending_review} · ${queueAge}h`}
              warn={queueAge !== null && queueAge >= 20}
            />
            <Stat label="Open reports" value={m.now.open_reports} warn={m.now.open_reports > 0} />
            <Stat label="Matches" value={m.now.matches} />
            <Stat label="Open groups" value={m.now.open_groups} />
            <Stat label="Messages, last 24h" value={m.now.messages_24h} />
            <Stat label="Videos overdue for deletion" value={m.now.videos_awaiting_cleanup} warn={m.now.videos_awaiting_cleanup > 0} />
          </section>

          <section className="mt-8">
            <h2 className="text-sm font-semibold text-neutral-800">Funnel (people who did each step at least once)</h2>
            <ul className="mt-3 space-y-2">
              {m.funnel.map((f) => (
                <li key={f.name} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 text-sm sm:grid-cols-[12rem_1fr_auto]">
                  <span className="text-neutral-700">{FUNNEL_LABELS[f.name] ?? f.name}</span>
                  <span className="order-last col-span-2 h-3 overflow-hidden rounded-full bg-neutral-100 sm:order-none sm:col-span-1">
                    <span
                      className="block h-full rounded-full bg-brand-500"
                      style={{ width: `${top ? Math.max((f.users / top) * 100, f.users ? 2 : 0) : 0}%` }}
                    />
                  </span>
                  <span className="w-28 text-right tabular-nums text-neutral-900">
                    {f.users}
                    <span className="ml-1 text-xs text-neutral-400">(+{f.last_24h} 24h)</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className="mt-8">
            <h2 className="text-sm font-semibold text-neutral-800">"I'd want this" votes</h2>
            {m.votes.length === 0 ? (
              <p className="mt-2 text-sm text-neutral-500">No votes yet.</p>
            ) : (
              <ul className="mt-2 divide-y divide-neutral-100 rounded-2xl border border-neutral-200 bg-white text-sm">
                {m.votes.map((v) => (
                  <li key={v.activity} className="flex justify-between px-4 py-2">
                    <span>{v.activity}</span>
                    <span className="tabular-nums">
                      {v.votes} <span className="text-xs text-neutral-400">({v.signed_in} signed in)</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <p className="mt-8 text-xs text-neutral-400">Updated {new Date(m.generated_at).toLocaleString()}</p>
        </>
      )}
    </main>
  )
}
