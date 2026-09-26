import { useState, type FormEvent, type ReactNode } from 'react'
import { REPORT_REASONS } from '../lib/chat'
import type { Database } from '../lib/database.types'
import { friendlyError } from '../lib/errors'
import { supabase } from '../lib/supabase'
import { Button, ErrorText, inputClass } from './ui'

type Reason = Database['public']['Enums']['report_reason']
type Target = { userId: string; name: string }

function Sheet({ label, onClose, children }: { label: string; onClose: () => void; children: ReactNode }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={label}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl">
        {children}
      </div>
    </div>
  )
}

function Helpline() {
  return (
    <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">
      If you're in danger or being threatened or stalked, call the national cybercrime helpline{' '}
      <a href="tel:1930" className="font-bold underline">
        1930
      </a>{' '}
      or report at{' '}
      <a href="https://cybercrime.gov.in" target="_blank" rel="noopener noreferrer" className="font-bold underline">
        cybercrime.gov.in
      </a>
      .
    </div>
  )
}

// Report flow (§2.4): reason, details, required consent to share the chat.
// Reporting also blocks the person, server-side.
export function ReportDialog({
  target,
  conversationId,
  onClose,
  onReported,
}: {
  target: Target
  conversationId: string | null
  onClose: () => void
  onReported: () => void
}) {
  const [reason, setReason] = useState<Reason | null>(null)
  const [details, setDetails] = useState('')
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (!reason) return setError('Please choose a reason.')
    if (!consent) return setError('Please tick the box to share this conversation with our safety team.')
    setBusy(true)
    const { error } = await supabase.rpc('report_user', {
      p_reported_id: target.userId,
      // Null for reports outside a chat; the generated type doesn't know it's optional.
      p_conversation_id: conversationId as string,
      p_reason: reason,
      p_details: details,
      p_consent: consent,
    })
    setBusy(false)
    if (error) return setError(friendlyError(error))
    setDone(true)
  }

  if (done) {
    return (
      <Sheet label="Report sent" onClose={onReported}>
        <h2 className="text-lg font-bold text-neutral-900">Thanks for telling us</h2>
        <p className="mt-2 text-sm text-neutral-600">
          Our safety team will review your report. We've also blocked {target.name}, so you won't see each other on
          Kollide again.
        </p>
        {reason === 'safety_threat' && (
          <div className="mt-3">
            <Helpline />
          </div>
        )}
        <Button className="mt-5 w-full" onClick={onReported}>
          Done
        </Button>
      </Sheet>
    )
  }

  return (
    <Sheet label={`Report ${target.name}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <h2 className="text-lg font-bold text-neutral-900">Report {target.name}</h2>
          <p className="mt-1 text-sm text-neutral-600">They won't know you reported them.</p>
        </div>

        <fieldset className="space-y-2">
          <legend className="mb-1 text-sm font-medium text-neutral-800">What happened?</legend>
          {REPORT_REASONS.map((r) => (
            <label
              key={r.value}
              className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-sm ${
                reason === r.value ? 'border-brand-600 bg-brand-50 font-semibold text-brand-700' : 'border-neutral-200'
              }`}
            >
              <input
                type="radio"
                name="reason"
                checked={reason === r.value}
                onChange={() => setReason(r.value)}
                className="accent-brand-600"
              />
              {r.label}
            </label>
          ))}
        </fieldset>

        {reason === 'safety_threat' && <Helpline />}

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-neutral-800">Anything else we should know? (optional)</span>
          <textarea
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            maxLength={2000}
            rows={3}
            className={inputClass}
          />
        </label>

        <label className="flex items-start gap-3 text-sm text-neutral-700">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-brand-600"
          />
          <span>
            {conversationId
              ? `I agree to share this conversation with Kollide's safety team so they can review it.`
              : `I agree to share this report with Kollide's safety team so they can review it.`}
          </span>
        </label>

        <ErrorText>{error}</ErrorText>
        <div className="flex gap-3">
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" variant="danger" className="flex-1" loading={busy}>
            Report and block
          </Button>
        </div>
      </form>
    </Sheet>
  )
}

export function BlockDialog({
  target,
  onClose,
  onBlocked,
  onReportInstead,
}: {
  target: Target
  onClose: () => void
  onBlocked: () => void
  onReportInstead: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function block() {
    setBusy(true)
    setError('')
    const { error } = await supabase.rpc('block_user', { p_target_id: target.userId })
    setBusy(false)
    if (error) return setError(friendlyError(error))
    onBlocked()
  }

  return (
    <Sheet label={`Block ${target.name}`} onClose={onClose}>
      <h2 className="text-lg font-bold text-neutral-900">Block {target.name}?</h2>
      <p className="mt-2 text-sm text-neutral-600">
        You won't see each other anywhere on Kollide, and this chat will close. They won't be told.
      </p>
      <p className="mt-2 text-sm text-neutral-600">
        If they made you feel unsafe,{' '}
        <button type="button" onClick={onReportInstead} className="font-semibold text-brand-700 underline">
          report them instead
        </button>
        . Reporting blocks them too.
      </p>
      <div className="mt-3">
        <ErrorText>{error}</ErrorText>
      </div>
      <div className="mt-4 flex gap-3">
        <Button variant="secondary" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button variant="danger" className="flex-1" onClick={block} loading={busy}>
          Block
        </Button>
      </div>
    </Sheet>
  )
}
