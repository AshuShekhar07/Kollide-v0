import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import AdminNav from '../../components/AdminNav'
import { Button, ErrorText, Spinner } from '../../components/ui'
import { REASON_LABELS } from '../../lib/chat'
import type { Database } from '../../lib/database.types'
import { friendlyError } from '../../lib/errors'
import { supabase } from '../../lib/supabase'

type Enums = Database['public']['Enums']
type QueueItem = Database['public']['Functions']['admin_reports_queue']['Returns'][number]

type Person = { user_id: string; first_name: string | null; public_code: string | null }
// admin_get_report returns jsonb; this is its shape.
type ReportDetail = {
  id: string
  reporter_id: string
  reported_id: string
  reason: Enums['report_reason']
  details: string | null
  status: Enums['report_status']
  created_at: string
  reported_banned: boolean
  reported_deleted: boolean
  ban_covers: string[]
  other_reports: { id: string; reason: Enums['report_reason']; status: Enums['report_status']; resolution: Enums['report_resolution'] | null; created_at: string }[]
  snapshot: {
    captured_at: string
    reporter: Person | null
    reported: (Person & { bio: string | null; gender: string | null; dob: string | null }) | null
    conversation?: {
      kind: Enums['conversation_kind']
      members: Person[] | null
      messages: { id: string; sender_id: string | null; body: string; created_at: string }[]
    }
  }
}

const RESOLUTIONS: { value: Enums['report_resolution']; label: string; variant: 'secondary' | 'danger' }[] = [
  { value: 'no_action', label: 'No action', variant: 'secondary' },
  { value: 'warning', label: 'Warning', variant: 'secondary' },
  { value: 'ban', label: 'Ban', variant: 'danger' },
]

function when(iso: string) {
  return new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
}

function who(p: Person | null | undefined) {
  if (!p) return 'Unknown'
  return `${p.first_name ?? 'Unknown'} ${p.public_code ?? ''}`.trim()
}

function Detail({ report, onResolved }: { report: ReportDetail; onResolved: () => void }) {
  const [busy, setBusy] = useState<Enums['report_resolution'] | null>(null)
  const [confirmBan, setConfirmBan] = useState(false)
  const [error, setError] = useState('')
  const { snapshot: snap } = report
  const names = new Map((snap.conversation?.members ?? []).map((m) => [m.user_id, m.first_name ?? 'Unknown']))

  async function resolve(resolution: Enums['report_resolution']) {
    if (resolution === 'ban' && !confirmBan) return setConfirmBan(true)
    setBusy(resolution)
    setError('')
    const { error } = await supabase.rpc('admin_resolve_report', { p_report_id: report.id, p_resolution: resolution })
    setBusy(null)
    if (error) return setError(friendlyError(error))
    onResolved()
  }

  return (
    <div className="space-y-5">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-xl font-bold text-neutral-900">{REASON_LABELS[report.reason]}</h2>
          {report.reported_banned && (
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800">Already banned</span>
          )}
          {report.reported_deleted && (
            <span className="rounded-full bg-neutral-200 px-2 py-0.5 text-xs font-semibold text-neutral-700">Account deleted</span>
          )}
        </div>
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-neutral-500">Reported</dt>
          <dd>
            <span className="font-semibold">{who(snap.reported)}</span>
            {!report.reported_deleted && (
              <Link to={`/admin/profiles?id=${report.reported_id}`} className="ml-2 text-brand-700 underline">
                View full profile
              </Link>
            )}
          </dd>
          <dt className="text-neutral-500">By</dt>
          <dd>{who(snap.reporter)}</dd>
          <dt className="text-neutral-500">When</dt>
          <dd>{when(report.created_at)}</dd>
          {snap.reported?.bio && (
            <>
              <dt className="text-neutral-500">Their bio</dt>
              <dd className="text-neutral-700">{snap.reported.bio}</dd>
            </>
          )}
        </dl>
        {report.details && (
          <blockquote className="mt-3 whitespace-pre-wrap rounded-xl bg-neutral-50 px-4 py-3 text-sm text-neutral-800">
            {report.details}
          </blockquote>
        )}
      </div>

      {report.other_reports.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-semibold">
            {report.other_reports.length} other report{report.other_reports.length === 1 ? '' : 's'} against this person
          </p>
          <ul className="mt-1 space-y-0.5">
            {report.other_reports.map((o) => (
              <li key={o.id}>
                {when(o.created_at)}: {REASON_LABELS[o.reason]} ({o.resolution?.replace('_', ' ') ?? o.status})
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <h3 className="text-sm font-semibold text-neutral-800">
          Conversation snapshot
          {snap.conversation && (
            <span className="ml-2 font-normal text-neutral-500">
              {snap.conversation.messages.length} messages, captured {when(snap.captured_at)}
            </span>
          )}
        </h3>
        {!snap.conversation ? (
          <p className="mt-2 text-sm text-neutral-500">Reported from their profile, not a chat.</p>
        ) : snap.conversation.messages.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-500">The chat had no messages.</p>
        ) : (
          <ol className="mt-2 max-h-[28rem] space-y-2 overflow-y-auto rounded-xl border border-neutral-200 p-3">
            {snap.conversation.messages.map((m) => {
              const isReported = m.sender_id === report.reported_id
              return (
                <li key={m.id} className="text-sm">
                  <span className={`font-semibold ${isReported ? 'text-red-700' : 'text-neutral-700'}`}>
                    {m.sender_id ? (names.get(m.sender_id) ?? 'Unknown') : 'Deleted user'}
                  </span>
                  <span className="ml-2 text-xs text-neutral-400">{when(m.created_at)}</span>
                  <p className="whitespace-pre-wrap break-words text-neutral-900">{m.body}</p>
                </li>
              )
            })}
          </ol>
        )}
      </div>

      <div className="space-y-3 border-t border-neutral-200 pt-4">
        {confirmBan && (
          <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">
            Banning bans their {report.ban_covers.join(', ') || 'account'}, freezes their chats and hides them everywhere.
            It can't be undone from here. Click Ban again to confirm.
          </p>
        )}
        <ErrorText>{error}</ErrorText>
        <div className="flex flex-wrap gap-3">
          {RESOLUTIONS.map((r) => (
            <Button
              key={r.value}
              variant={r.variant}
              onClick={() => resolve(r.value)}
              loading={busy === r.value}
              disabled={!!busy || (r.value === 'ban' && report.reported_banned)}
            >
              {r.value === 'ban' && confirmBan ? 'Confirm ban' : r.label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function AdminReports() {
  const [queue, setQueue] = useState<QueueItem[] | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [report, setReport] = useState<ReportDetail | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('admin_reports_queue')
    if (error) return setError(friendlyError(error))
    setQueue(data)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // Opening a report is logged server-side, so it only happens on a click.
  async function open(id: string) {
    setSelected(id)
    setReport(null)
    setError('')
    const { data, error } = await supabase.rpc('admin_get_report', { p_report_id: id })
    if (error) return setError(friendlyError(error))
    setReport(data as unknown as ReportDetail)
    setQueue((q) => q?.map((r) => (r.report_id === id && r.status === 'open' ? { ...r, status: 'reviewing' } : r)) ?? null)
  }

  function onResolved() {
    setSelected(null)
    setReport(null)
    load()
  }

  return (
    <main className="mx-auto max-w-5xl px-4 pb-16 pt-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="text-lg font-extrabold tracking-tight text-brand-700">Kollide admin</span>
          <h1 className="text-2xl font-bold text-neutral-900">Reports</h1>
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
      {!queue && !error && <Spinner />}
      {queue?.length === 0 && <p className="mt-16 text-center text-neutral-500">No open reports.</p>}

      {queue && queue.length > 0 && (
        <div className="mt-6 grid gap-6 md:grid-cols-[280px_1fr]">
          <ul className="space-y-1">
            {queue.map((r) => (
              <li key={r.report_id}>
                <button
                  type="button"
                  onClick={() => open(r.report_id)}
                  className={`w-full rounded-xl px-3 py-2 text-left text-sm ${
                    r.report_id === selected ? 'bg-brand-50 text-brand-700' : 'hover:bg-neutral-50'
                  }`}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-semibold">
                      {r.reported_name ?? 'Unknown'}{' '}
                      <span className="font-mono text-xs font-normal text-neutral-500">{r.reported_code}</span>
                    </span>
                    {r.status === 'open' ? (
                      <span className="rounded-full bg-brand-600 px-2 py-0.5 text-[10px] font-bold uppercase text-white">New</span>
                    ) : (
                      <span className="text-[10px] font-semibold uppercase text-neutral-400">Seen</span>
                    )}
                  </span>
                  <span className="block text-xs text-neutral-600">{REASON_LABELS[r.reason]}</span>
                  <span className="block text-xs text-neutral-400">
                    {when(r.created_at)}
                    {r.reports_against > 1 && ` · ${r.reports_against} reports`}
                    {r.reported_banned && ' · banned'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <div>
            {!selected && <p className="text-sm text-neutral-500">Pick a report to open it. Every open is logged.</p>}
            {selected && !report && !error && <Spinner />}
            {report && <Detail key={report.id} report={report} onResolved={onResolved} />}
          </div>
        </div>
      )}
    </main>
  )
}
