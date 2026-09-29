import { useCallback, useEffect, useState } from 'react'
import AdminNav from '../../components/AdminNav'
import AdminProfile from '../../components/AdminProfile'
import { Button, ErrorText, Spinner, inputClass } from '../../components/ui'
import type { Database } from '../../lib/database.types'
import { friendlyError, functionError } from '../../lib/errors'
import { signedPhotoUrls } from '../../lib/photos'
import { supabase } from '../../lib/supabase'

type QueueItem = Database['public']['Functions']['admin_verification_queue']['Returns'][number]

const REJECT_REASONS = [
  "Face doesn't match the photos",
  'Face not clearly visible',
  "Didn't follow the head-turn prompts",
  'Video appears to be a recording of a screen or photo',
  'Appears to be under 18',
  'Intro, answers or socials contain offensive content',
]

function waitingFor(iso: string): { label: string; hours: number } {
  const hours = (Date.now() - new Date(iso).getTime()) / 36e5
  const label = hours < 1 ? `${Math.max(1, Math.round(hours * 60))}m` : `${Math.floor(hours)}h ${Math.round((hours % 1) * 60)}m`
  return { label, hours }
}

function ageBadge(hours: number) {
  if (hours >= 20) return 'bg-red-100 text-red-800'
  if (hours >= 12) return 'bg-amber-100 text-amber-800'
  return 'bg-green-100 text-green-800'
}

function Review({ item, onDone }: { item: QueueItem; onDone: () => void }) {
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [videoFailed, setVideoFailed] = useState(false)
  const [photoUrls, setPhotoUrls] = useState<(string | null)[]>([])
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    setVideoUrl(null)
    setVideoFailed(false)
    setError('')
    // Each call is logged server-side as a `view_video` access.
    supabase.functions.invoke('admin-video-url', { body: { video_id: item.video_id } }).then(async ({ data, error }) => {
      if (cancelled) return
      if (error) {
        setVideoFailed(true)
        setError(await functionError(error))
      } else setVideoUrl(data.url)
    })
    signedPhotoUrls(item.photo_paths).then((urls) => !cancelled && setPhotoUrls(urls))
    return () => {
      cancelled = true
    }
  }, [item])

  async function decide(approve: boolean) {
    setError('')
    if (!approve && !reason.trim()) return setError('Choose or type a reason for rejecting.')
    setBusy(approve ? 'approve' : 'reject')
    const { error } = await supabase.rpc('admin_review_verification', {
      p_user_id: item.user_id,
      p_approve: approve,
      p_reason: approve ? undefined : reason.trim(),
    })
    setBusy(null)
    if (error) return setError(friendlyError(error))
    onDone()
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline gap-x-3">
        <h2 className="text-xl font-bold text-neutral-900">
          {item.first_name}, {item.age}
        </h2>
        <span className="font-mono text-sm text-neutral-500">{item.public_code}</span>
        <span className="text-sm capitalize text-neutral-500">{item.gender?.replace('_', '-')}</span>
        {item.is_resubmission && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">Resubmission</span>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="overflow-hidden rounded-2xl bg-black">
          {videoUrl ? (
            <video key={videoUrl} src={videoUrl} controls autoPlay muted playsInline className="aspect-[3/4] w-full object-contain" />
          ) : (
            <div className="flex aspect-[3/4] items-center justify-center text-sm text-neutral-400">
              {videoFailed ? 'Video unavailable' : 'Loading video…'}
            </div>
          )}
        </div>
        <ul className="grid grid-cols-3 content-start gap-2">
          {photoUrls.map((url, i) => (
            <li key={i} className="aspect-[3/4] overflow-hidden rounded-xl bg-neutral-100">
              {url && <img src={url} alt={`Photo ${i + 1}`} className="h-full w-full object-cover" />}
            </li>
          ))}
        </ul>
      </div>

      <AdminProfile userId={item.user_id} embedded />

      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          {REJECT_REASONS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setReason(r)}
              className={`rounded-full border px-3 py-1 text-xs ${reason === r ? 'border-red-600 bg-red-50 text-red-700' : 'border-neutral-300 text-neutral-600'}`}
            >
              {r}
            </button>
          ))}
        </div>
        <input
          value={reason}
          maxLength={500}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Rejection reason (sent to the user)"
          className={inputClass}
        />
      </div>

      <ErrorText>{error}</ErrorText>
      <div className="flex gap-3">
        <Button variant="danger" onClick={() => decide(false)} loading={busy === 'reject'} disabled={!!busy}>
          Reject
        </Button>
        <Button className="flex-1" onClick={() => decide(true)} loading={busy === 'approve'} disabled={!!busy}>
          Approve
        </Button>
      </div>
    </div>
  )
}

export default function AdminVerification() {
  const [queue, setQueue] = useState<QueueItem[] | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('admin_verification_queue')
    if (error) return setError(friendlyError(error))
    setQueue(data)
    setSelected((cur) => (cur && data.some((d) => d.video_id === cur) ? cur : (data[0]?.video_id ?? null)))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const current = queue?.find((q) => q.video_id === selected)
  const oldest = queue?.[0] ? waitingFor(queue[0].submitted_at) : null

  return (
    <main className="mx-auto max-w-5xl px-4 pb-16 pt-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="text-lg font-extrabold tracking-tight text-brand-700">Kollide admin</span>
          <h1 className="text-2xl font-bold text-neutral-900">Verification queue</h1>
        </div>
        <AdminNav />
        {queue && (
          <div className="flex items-center gap-3 text-sm">
            <span className="rounded-full bg-neutral-100 px-3 py-1 font-semibold">{queue.length} waiting</span>
            {oldest && (
              <span className={`rounded-full px-3 py-1 font-semibold ${ageBadge(oldest.hours)}`}>
                Oldest: {oldest.label}
              </span>
            )}
            <Button variant="secondary" className="px-3 py-1.5 text-sm" onClick={load}>
              Refresh
            </Button>
          </div>
        )}
      </header>

      <ErrorText>{error}</ErrorText>
      {!queue && !error && <Spinner />}
      {queue?.length === 0 && (
        <p className="mt-16 text-center text-neutral-500">Queue is empty. Nice work.</p>
      )}

      {queue && queue.length > 0 && (
        <div className="mt-6 grid gap-6 md:grid-cols-[240px_1fr]">
          <ul className="space-y-1">
            {queue.map((q) => {
              const w = waitingFor(q.submitted_at)
              return (
                <li key={q.video_id}>
                  <button
                    type="button"
                    onClick={() => setSelected(q.video_id)}
                    className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm ${
                      q.video_id === selected ? 'bg-brand-50 font-semibold text-brand-800' : 'hover:bg-neutral-50'
                    }`}
                  >
                    <span>
                      {q.first_name} <span className="font-mono text-xs text-neutral-500">{q.public_code}</span>
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-xs ${ageBadge(w.hours)}`}>{w.label}</span>
                  </button>
                </li>
              )
            })}
          </ul>
          {current && <Review key={current.video_id} item={current} onDone={load} />}
        </div>
      )}
    </main>
  )
}
